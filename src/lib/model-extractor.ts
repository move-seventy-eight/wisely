// LLM Model Extractor
// Extracts available models from LLM services using JSONPath expressions

import { LLM_SIGNATURES, matchSignature, ModelExtraction } from './llm-signatures';

// Simple JSONPath implementation for common patterns
function extractByPath(data: any, path: string): string[] {
    try {
        // Handle common JSONPath patterns
        // $.models[*].name -> data.models.map(m => m.name)
        // $.data[*].id -> data.data.map(d => d.id)
        // $.result -> data.result
        // $.model_id -> data.model_id

        const parts = path.replace('$.', '').split('.');
        let current: any = data;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            // Handle array wildcard [*]
            if (part.includes('[*]')) {
                const arrayKey = part.replace('[*]', '');
                if (arrayKey && current[arrayKey]) {
                    current = current[arrayKey];
                }

                // Get remaining path after [*]
                const remainingParts = parts.slice(i + 1);
                if (remainingParts.length > 0 && Array.isArray(current)) {
                    const field = remainingParts.join('.');
                    return current.map((item: any) => {
                        let val = item;
                        for (const p of remainingParts) {
                            val = val?.[p];
                        }
                        return val;
                    }).filter(Boolean);
                }
                return Array.isArray(current) ? current : [];
            } else {
                current = current?.[part];
            }
        }

        // Return as array
        if (Array.isArray(current)) {
            return current.map(String);
        } else if (current) {
            return [String(current)];
        }
        return [];
    } catch (error) {
        console.error('JSONPath extraction error:', error);
        return [];
    }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 3000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(id);
    }
}

export interface ModelExtractionResult {
    success: boolean;
    provider: string;
    models: string[];
    error?: string;
}

/**
 * Extract models from an LLM service
 */
export async function extractModels(
    ip: string,
    port: number,
    serviceName?: string
): Promise<ModelExtractionResult> {
    const protocol = port === 443 ? 'https' : 'http';
    const host = ip.includes(':') ? `[${ip}]` : ip;
    const baseUrl = `${protocol}://${host}:${port}`;

    // Find matching signature
    const signature = serviceName ? matchSignature(serviceName) : undefined;

    // Try multiple extraction methods
    const extractionAttempts: ModelExtraction[] = [];

    // Add signature-specific extraction first
    if (signature?.modelExtraction) {
        extractionAttempts.push(signature.modelExtraction);
    }

    // Add common extraction patterns as fallbacks
    // These are standard endpoints used by many tools (OpenAI compatible, etc.)
    const commonExtractions: ModelExtraction[] = [
        { endpoint: '/v1/models', method: 'GET', jsonPath: '$.data[*].id', transform: 'array' }, // OpenAI/vLLM/LocalAI standard
        { endpoint: '/api/tags', method: 'GET', jsonPath: '$.models[*].name', transform: 'array' }, // Ollama
        { endpoint: '/api/v1/model', method: 'GET', jsonPath: '$.result', transform: 'single' }, // TextGenWebUI
        { endpoint: '/info', method: 'GET', jsonPath: '$.model_id', transform: 'single' }, // TGI
        { endpoint: '/models/available', method: 'GET', jsonPath: '$.[*].id', transform: 'array' }, // Some LocalAI versions
        { endpoint: '/props', method: 'GET', jsonPath: '$.default_generation_settings.model', transform: 'single' } // llama.cpp
    ];

    for (const extraction of commonExtractions) {
        // Avoid duplicates if signature already has this endpoint
        if (!extractionAttempts.find(e => e.endpoint === extraction.endpoint)) {
            extractionAttempts.push(extraction);
        }
    }

    // Try each extraction method
    for (const extraction of extractionAttempts) {
        try {
            const url = `${baseUrl}${extraction.endpoint}`;
            const res = await fetchWithTimeout(url, {
                method: extraction.method,
                headers: extraction.headers
            });

            if (res.ok) {
                const data = await res.json();
                const models = extractByPath(data, extraction.jsonPath);

                if (models.length > 0) {
                    return {
                        success: true,
                        provider: signature?.provider || 'unknown',
                        models
                    };
                }
            }
        } catch (error) {
            // Continue to next extraction method
        }
    }

    return {
        success: false,
        provider: signature?.provider || 'unknown',
        models: [],
        error: 'No models found'
    };
}

/**
 * Probe service and extract models in one call
 */
export async function probeAndExtractModels(ip: string, port: number): Promise<{
    service: string;
    models: string[];
    details: any;
}> {
    const protocol = port === 443 ? 'https' : 'http';
    const host = ip.includes(':') ? `[${ip}]` : ip;
    const baseUrl = `${protocol}://${host}:${port}`;

    let detectedService = 'Unknown';
    let models: string[] = [];
    let details: any = {};

    // Try each signature's probes
    for (const signature of LLM_SIGNATURES) {
        for (const probe of signature.probes) {
            try {
                const url = `${baseUrl}${probe.path}`;
                const res = await fetchWithTimeout(url, {
                    method: probe.method,
                    headers: probe.headers
                });

                if (res.ok) {
                    const text = await res.text();

                    // Check match patterns
                    if (probe.matchPatterns) {
                        const matched = probe.matchPatterns.some(p => text.includes(p));
                        if (!matched) continue;
                    }

                    // Service Detected!
                    detectedService = signature.displayName;
                    details.endpoint = probe.path;

                    // Try to extract models using the signature's specific method
                    if (signature.modelExtraction) {
                        const extraction = await extractModels(ip, port, signature.provider);
                        if (extraction.success && extraction.models.length > 0) {
                            models = extraction.models;
                            // If we found models, we are done
                            return { service: detectedService, models, details };
                        }
                    }

                    // If signature didn't have extraction or it failed, try generic/common extractions
                    // But only if we don't have models yet
                    if (models.length === 0) {
                        const genericExtraction = await extractModels(ip, port); // No provider, tries all common
                        if (genericExtraction.success && genericExtraction.models.length > 0) {
                            models = genericExtraction.models;
                            return { service: detectedService, models, details };
                        }
                    }

                    // If we matched a service but couldn't extract models, we still return the service
                    // But maybe we should continue searching if this was a weak match? 
                    // For now, let's return what we found, but maybe mark models as empty.
                    return { service: detectedService, models, details };
                }
            } catch {
                // Continue to next probe
            }
        }
    }

    // If no signature matched, try generic model extraction as a last resort
    // This handles cases where we might not match a known service probe but it speaks a standard API
    const fallbackExtraction = await extractModels(ip, port);
    if (fallbackExtraction.success && fallbackExtraction.models.length > 0) {
        return {
            service: fallbackExtraction.provider !== 'unknown' ? fallbackExtraction.provider : 'Unknown LLM Service',
            models: fallbackExtraction.models,
            details: { note: 'Detected via model extraction endpoint' }
        };
    }

    return { service: detectedService, models, details };
}
