import { N8nWorkflow } from './types';

export interface N8nEnvConfig {
    apiKey: string;
    baseUrl: string;
}

export async function fetchWorkflows(env: N8nEnvConfig): Promise<N8nWorkflow[]> {
    if (!env.apiKey || !env.baseUrl) {
        console.error("Missing N8N_API_KEY or N8N_BASE_URL in env config");
        return [];
    }

    // Remove trailing slash from base URL if present
    const baseUrl = env.baseUrl.replace(/\/$/, "");
    const url = `${baseUrl}/api/v1/workflows`;

    try {
        console.log(`Fetching workflows from: ${url}`);
        const response = await fetch(url, {
            headers: {
                'X-N8N-API-KEY': env.apiKey,
            },
            next: { revalidate: 0 } // Disable caching for fresh data
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`Failed to fetch workflows. Status: ${response.status} ${response.statusText}. Response: ${text.slice(0, 500)}`);
            throw new Error(`Failed to fetch workflows: ${response.statusText}`);
        }

        // Clone response just in case we need to read text for debugging if json fails
        const clone = response.clone();
        try {
            const data = await response.json();
            return data.data;
        } catch (e) {
            const text = await clone.text();
            console.error(`Failed to parse JSON. Response start: ${text.slice(0, 200)}...`);
            throw e;
        }
    } catch (error) {
        console.error("Error fetching workflows:", error);
        return [];
    }
}

export async function fetchWorkflow(env: N8nEnvConfig, id: string): Promise<N8nWorkflow | null> {
    if (!env.apiKey || !env.baseUrl) return null;

    // Remove trailing slash from base URL if present
    const baseUrl = env.baseUrl.replace(/\/$/, "");
    const url = `${baseUrl}/api/v1/workflows/${id}`;

    try {
        const response = await fetch(url, {
            headers: {
                'X-N8N-API-KEY': env.apiKey,
            },
            next: { revalidate: 0 }
        });

        if (!response.ok) {
            if (response.status === 404) return null;
            const text = await response.text();
            console.error(`Failed to fetch workflow ${id}. Status: ${response.status}. Response: ${text.slice(0, 200)}`);
            throw new Error(`Failed to fetch workflow ${id}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching workflow ${id}:`, error);
        return null;
    }
}

export async function fetchWorkflowExecutions(env: N8nEnvConfig, workflowId: string, limit: number = 20): Promise<any[]> {
    if (!env.apiKey || !env.baseUrl) return [];

    const baseUrl = env.baseUrl.replace(/\/$/, "");
    const url = `${baseUrl}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`;

    try {
        console.log(`[fetchWorkflowExecutions] Fetching: ${url}`);
        const response = await fetch(url, {
            headers: {
                'X-N8N-API-KEY': env.apiKey,
            },
            next: { revalidate: 0 }
        });

        if (!response.ok) {
            console.error(`Failed to fetch executions for workflow ${workflowId}. Status: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error(`Error fetching executions for workflow ${workflowId}:`, error);
        return [];
    }
}

export async function fetchExecutionDetails(env: N8nEnvConfig, executionId: string): Promise<any | null> {
    if (!env.apiKey || !env.baseUrl) return null;

    const baseUrl = env.baseUrl.replace(/\/$/, "");
    const url = `${baseUrl}/api/v1/executions/${executionId}?includeData=true`;

    try {
        const response = await fetch(url, {
            headers: {
                'X-N8N-API-KEY': env.apiKey,
            },
            next: { revalidate: 0 }
        });

        if (!response.ok) {
            console.error(`Failed to fetch execution details for ${executionId}. Status: ${response.status}`);
            return null;
        }

        const data = await response.json();
        return data; // single execution returned directly
    } catch (error) {
        console.error(`Error fetching execution details for ${executionId}:`, error);
        return null;
    }
}

export async function fetchN8nVersion(env: N8nEnvConfig): Promise<string | null> {
    if (!env.baseUrl) return null;

    const baseUrl = env.baseUrl.replace(/\/$/, "");

    try {
        const response = await fetch(`${baseUrl}/`, {
            next: { revalidate: 3600 }
        });

        if (!response.ok) {
            return null;
        }

        const text = await response.text();

        // Try to extract version from JavaScript variables or meta tags typically found in n8n's index.html
        // Example: window.N8N_VERSION = "0.233.1";
        const versionMatch = text.match(/window\.(?:N8N_VERSION|version)\s*=\s*['"]([^'"]+)['"]/i) ||
            text.match(/<meta\s+name=["']version["']\s+content=["']([^'"]+)["']/i);

        if (versionMatch && versionMatch[1]) {
            return versionMatch[1];
        }

        // Try extracting from Sentry config
        // Example: <meta name="n8n:config:sentry" content="eyJkc24iOiIiLCJlbnZpcm9ubWVudCI6ImRldmVsb3BtZW50IiwicmVsZWFzZSI6Im44bkAyLjYuNCJ9">
        // Also catches obfuscated names like: <meta name="testi:config:sentry" content="...">
        const sentryMatch = text.match(/<meta\s+name=["'](?:[^:]+):config:sentry["']\s+content=["']([^'"]+)["']/i);
        if (sentryMatch && sentryMatch[1]) {
            try {
                const decodedStr = Buffer.from(sentryMatch[1], 'base64').toString('utf-8');
                const sentryConfig = JSON.parse(decodedStr);
                if (sentryConfig.release && typeof sentryConfig.release === 'string') {
                    // release format might be "n8n@2.6.4" or "2.6.4"
                    const releaseParsed = sentryConfig.release.split('@');
                    const ver = releaseParsed.length > 1 ? releaseParsed[1] : releaseParsed[0];
                    return ver;
                }
            } catch (e) {
                console.error(`Failed to parse n8n sentry config:`, e);
            }
        }

        return null; // Could not detect automatically
    } catch (error) {
        console.error(`Error fetching N8N version from ${baseUrl}:`, error);
        return null;
    }
}

export interface N8nConnectionStatus {
    connected: boolean;
    status: 'operational' | 'offline' | 'auth_error' | 'not_configured';
    title: string;
    description: string;
    baseUrl?: string;
    version?: string | null;
}

export async function checkN8nStatus(env?: { baseUrl?: string; apiKey?: string | null }): Promise<N8nConnectionStatus> {
    const rawUrl = env?.baseUrl?.trim();
    if (!rawUrl) {
        return {
            connected: false,
            status: 'not_configured',
            title: 'n8n Not Configured',
            description: 'Configure in Settings'
        };
    }

    const baseUrl = rawUrl.replace(/\/$/, "");

    try {
        // Fast health probe with 2.5s timeout
        let healthOk = false;
        let responseStatus = 0;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const healthRes = await fetch(`${baseUrl}/healthz`, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Wisely-Health-Check/1.0' },
                cache: 'no-store'
            });
            clearTimeout(timeoutId);
            responseStatus = healthRes.status;
            healthOk = healthRes.ok || healthRes.status === 200;
        } catch {
            // Fallback to checking root path
            try {
                const rootController = new AbortController();
                const rootTimeoutId = setTimeout(() => rootController.abort(), 2500);
                const rootRes = await fetch(`${baseUrl}/`, {
                    signal: rootController.signal,
                    cache: 'no-store'
                });
                clearTimeout(rootTimeoutId);
                responseStatus = rootRes.status;
                healthOk = rootRes.ok || rootRes.status === 200 || rootRes.status === 401;
            } catch {
                healthOk = false;
            }
        }

        if (!healthOk && responseStatus === 0) {
            return {
                connected: false,
                status: 'offline',
                title: 'n8n Disconnected',
                description: 'Instance unreachable',
                baseUrl
            };
        }

        // If API key is provided, verify authorization
        if (env?.apiKey && env.apiKey.trim().length > 0) {
            try {
                const apiController = new AbortController();
                const apiTimeoutId = setTimeout(() => apiController.abort(), 2500);
                const apiRes = await fetch(`${baseUrl}/api/v1/workflows?limit=1`, {
                    signal: apiController.signal,
                    headers: {
                        'X-N8N-API-KEY': env.apiKey.trim()
                    },
                    cache: 'no-store'
                });
                clearTimeout(apiTimeoutId);

                if (apiRes.status === 401 || apiRes.status === 403) {
                    return {
                        connected: false,
                        status: 'auth_error',
                        title: 'n8n Auth Failed',
                        description: 'Invalid API Key',
                        baseUrl
                    };
                }
            } catch {
                // Ignore API timeout if base health is ok
            }
        }

        if (healthOk) {
            return {
                connected: true,
                status: 'operational',
                title: 'n8n Connected',
                description: 'System Operational',
                baseUrl
            };
        }

        return {
            connected: false,
            status: 'offline',
            title: 'n8n Unhealthy',
            description: `HTTP ${responseStatus} error`,
            baseUrl
        };
    } catch {
        return {
            connected: false,
            status: 'offline',
            title: 'n8n Disconnected',
            description: 'Instance unreachable',
            baseUrl
        };
    }
}
