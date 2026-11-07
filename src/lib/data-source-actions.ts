'use server'

import prisma from './db';
import { analyzeContent } from './shadow-ai';
import crypto from 'crypto';
import { requirePermission } from './auth';

// Data Source Types
export type DataSourceType = 'proxy' | 'api' | 'kafka' | 'scanner';

// Get all configured data sources
export async function getDataSources() {
    await requirePermission('SHADOW_AI_VIEW');
    return prisma.dataSource.findMany({
        orderBy: { createdAt: 'desc' }
    });
}

// Create a new data source
export async function createDataSource(data: {
    name: string;
    type: DataSourceType;
    enabled?: boolean;
    config?: string;
    endpoint?: string;
}) {
    await requirePermission('SHADOW_AI_MANAGE');
    return prisma.dataSource.create({
        data: {
            name: data.name,
            type: data.type,
            enabled: data.enabled ?? true,
            config: data.config,
            endpoint: data.endpoint
        }
    });
}

// Toggle data source enabled/disabled
export async function toggleDataSource(id: string) {
    await requirePermission('SHADOW_AI_MANAGE');
    const source = await prisma.dataSource.findUnique({ where: { id } });
    if (!source) throw new Error('Data source not found');

    return prisma.dataSource.update({
        where: { id },
        data: { enabled: !source.enabled }
    });
}

// Delete a data source
export async function deleteDataSource(id: string) {
    await requirePermission('SHADOW_AI_MANAGE');
    return prisma.dataSource.delete({ where: { id } });
}

// Generate API key for a data source
export async function generateApiKey(dataSourceId: string) {
    await requirePermission('SHADOW_AI_MANAGE');
    const apiKey = `wis_${crypto.randomBytes(32).toString('hex')}`;

    await prisma.dataSource.update({
        where: { id: dataSourceId },
        data: {
            endpoint: apiKey,
            config: JSON.stringify({ apiKey, generatedAt: new Date().toISOString() })
        }
    });

    return apiKey;
}

// Ingest LLM request from external source
export async function ingestLLMRequest(data: {
    sourceIp: string;
    targetUrl: string;
    prompt?: string;
    response?: string;
    model?: string;
    provider?: string;
    timestamp?: string;
    dataSourceId?: string;
    apiKey?: string;
}) {
    // Validate API key if provided
    if (data.apiKey) {
        const source = await prisma.dataSource.findFirst({
            where: { endpoint: data.apiKey, enabled: true }
        });
        if (!source) {
            throw new Error('Invalid or disabled API key');
        }
        data.dataSourceId = source.id;

        // Update source activity
        await prisma.dataSource.update({
            where: { id: source.id },
            data: {
                lastActivity: new Date(),
                requestCount: { increment: 1 }
            }
        });
    }

    // Parse target URL to get IP and port
    let targetIp = 'unknown';
    let targetPort = 443;
    try {
        const url = new URL(data.targetUrl);
        targetIp = url.hostname;
        targetPort = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
    } catch (e) {
        console.error('Failed to parse target URL:', data.targetUrl);
    }

    // Detect provider from URL
    const providerMap: Record<string, string> = {
        'api.openai.com': 'OpenAI',
        'api.anthropic.com': 'Anthropic',
        'generativelanguage.googleapis.com': 'Google',
        'api.cohere.ai': 'Cohere',
        'localhost:11434': 'Ollama'
    };
    const detectedProvider = data.provider || providerMap[targetIp] || 'Unknown';

    // Analyze content for sensitive data
    const contentToAnalyze = [data.prompt, data.response].filter(Boolean).join(' ');
    const analysis = analyzeContent(contentToAnalyze);

    // Create prompt hash for privacy
    const promptHash = data.prompt
        ? crypto.createHash('sha256').update(data.prompt).digest('hex').slice(0, 16)
        : null;

    // Create request record
    const request = await prisma.lLMRequest.create({
        data: {
            sourceIp: data.sourceIp,
            targetIp,
            targetPort,
            provider: detectedProvider,
            model: data.model,
            promptHash,
            promptPreview: data.prompt?.slice(0, 200),
            responsePreview: data.response?.slice(0, 200),
            riskScore: analysis.riskScore,
            isFlagged: analysis.isFlagged,
            flags: (analysis as any).matchedRules?.length > 0 ? JSON.stringify((analysis as any).matchedRules) : null,
            dataSourceId: data.dataSourceId,
            timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
        }
    });

    // Create alert if flagged
    if (analysis.isFlagged) {
        await prisma.threatAlert.create({
            data: {
                requestId: request.id,
                severity: analysis.riskScore >= 80 ? 'critical' : analysis.riskScore >= 50 ? 'high' : 'medium',
                message: `Sensitive data detected: ${((analysis as any).matchedRules || []).slice(0, 3).join(', ')}`
            }
        });
    }

    return request;
}

// Seed default data sources
export async function seedDefaultDataSources() {
    await requirePermission('SHADOW_AI_MANAGE');
    const count = await prisma.dataSource.count();
    if (count > 0) return;

    const defaultSources = [
        {
            name: 'Network Scanner',
            type: 'scanner',
            enabled: true,
            config: JSON.stringify({ description: 'Built-in network scanner for LLM service discovery' })
        },
        {
            name: 'API Ingestion',
            type: 'api',
            enabled: true,
            config: JSON.stringify({ description: 'REST API endpoint for external log submission' })
        }
    ];

    for (const source of defaultSources) {
        await prisma.dataSource.create({ data: source });
    }
}

// Get live feed of recent requests (for polling)
export async function getLiveFeed(since?: Date, limit = 50) {
    await requirePermission('SHADOW_AI_VIEW');
    const where = since ? { timestamp: { gt: since } } : {};

    return prisma.lLMRequest.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit
    });
}

// Get only flagged requests
export async function getFlaggedRequests(limit = 50) {
    await requirePermission('SHADOW_AI_VIEW');
    return prisma.lLMRequest.findMany({
        where: { isFlagged: true },
        orderBy: { timestamp: 'desc' },
        take: limit
    });
}

// SIMULATION: Generate synthetic Kafka traffic
export async function simulateKafkaTraffic(dataSourceId: string) {
    await requirePermission('SHADOW_AI_MANAGE');
    const prompts = [
        "Explain quantum computing to a 5 year old",
        "Write a python script to scan for open ports",
        "What is the capital of France?",
        "Debug this sql query: SELECT * FROM users WHERE password = '123'",
        "Generate a fake credit card number for testing",
        "How do I bundle a react app using vite?",
        "Summarize this meeting notes.",
        "Translate 'Hello world' to Spanish"
    ];

    const responses = [
        "Quantum computing uses qubits...",
        "Here is a python script using nmap...",
        "The capital of France is Paris.",
        "Your SQL query is vulnerable to injection...",
        "I cannot generate valid credit card numbers...",
        "To bundle with Vite, run npm run build.",
        "Meeting summary: Project deadline extended.",
        "Hola Mundo"
    ];

    const models = ["gpt-4", "claude-3-opus", "llama-3-70b", "gemini-1.5-pro"];

    // Generate 5 random requests
    for (let i = 0; i < 5; i++) {
        const randomIdx = Math.floor(Math.random() * prompts.length);
        const randomModel = models[Math.floor(Math.random() * models.length)];

        // Simulate a slight delay between logs
        await new Promise(r => setTimeout(r, 200));

        await ingestLLMRequest({
            sourceIp: `192.168.1.${Math.floor(Math.random() * 255)}`,
            targetUrl: `https://api.simulated-kafka.com/v1/chat/completions`,
            prompt: prompts[randomIdx],
            response: responses[randomIdx],
            model: randomModel,
            dataSourceId,
            timestamp: new Date().toISOString()
        });
    }

    return { success: true, count: 5 };
}
