import net from 'net';

export interface ServiceScanResult {
    ip: string;
    port: number;
    open: boolean;
    service: string;
    details?: any;
}

const COMMON_LLM_PORTS = [
    11434, // Ollama
    8000,  // vLLM, FastChat, many python servers
    8080,  // Llama.cpp, generic
    5000,  // Flask based
    3000,  // Web UIs
    1234,  // LM Studio
    9000,  // Portainer / MinIO
    80,    // HTTP
    443    // HTTPS
];

// Julius-inspired probes
const PROBES = [
    { path: '/api/tags', method: 'GET', type: 'ollama' },
    { path: '/v1/models', method: 'GET', type: 'openai' },
    { path: '/health', method: 'GET', type: 'generic' },
    { path: '/docs', method: 'GET', type: 'documentation' },
    { path: '/openapi.json', method: 'GET', type: 'schema' }
];

function checkPort(ip: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000); // Bumped back to 1000ms for reliability
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', (err) => {
            // console.error(`Port ${port} on ${ip} error:`, err.message);
            resolve(false);
        });
        socket.connect(port, ip);
    });
}

async function fetchWithTimeout(url: string, options: any = {}, timeout = 2000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(id);
    }
}

async function probeService(ip: string, port: number): Promise<{ service: string, details: any } | null> {
    const protocol = port === 443 ? 'https' : 'http';
    // Handle IPv6 literals in URL
    const host = ip.includes(':') ? `[${ip}]` : ip;
    const baseUrl = `${protocol}://${host}:${port}`;

    // 3. Simple Root Check
    try {
        const controller3 = new AbortController();
        const timeoutId3 = setTimeout(() => controller3.abort(), 1500);
        const res = await fetch(`${baseUrl}/`, { signal: controller3.signal });
        clearTimeout(timeoutId3);
        if (res.ok) {
            const text = await res.text();

            // Ollama specific plain text check
            if (text.trim() === 'Ollama is running') {
                return { service: "Ollama", details: { status: "running" } };
            }

            const titleMatch = text.match(/<title>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : 'No Title';

            if (title.includes("Ollama")) return { service: "Ollama Web UI", details: { title } };
            if (title.includes(" n8n ")) return { service: "n8n Workflow Automation", details: { title } };

            return { service: "Web Service", details: { title: title.substring(0, 50) } };
        }
    } catch { }

    // Run probes in parallel for speed
    const probePromises = PROBES.map(async (probe) => {
        try {
            const res = await fetchWithTimeout(`${baseUrl}${probe.path}`);
            return { probe, res, status: res.status };
        } catch {
            return null;
        }
    });

    const results = (await Promise.all(probePromises)).filter(r => r !== null);

    if (results.length === 0) return { service: "Unknown TCP Service", details: null };

    // Analyze Results
    let service = "Web Service";
    let details: any = { probes: results.map(r => `${r?.probe.path} (${r?.status})`) };

    // 1. Ollama Detection
    const ollamaProbe = results.find(r => r?.probe.path === '/api/tags');
    if (ollamaProbe && ollamaProbe.res.ok) {
        try {
            const data = await ollamaProbe.res.json();
            if (data.models) {
                return { service: "Ollama", details: { ...details, modelCount: data.models.length } };
            }
        } catch { }
    }

    // 2. OpenAI Compatible (vLLM, LM Studio, etc.)
    const openaiProbe = results.find(r => r?.probe.path === '/v1/models');
    if (openaiProbe && openaiProbe.res.ok) {
        try {
            const data = await openaiProbe.res.json();
            const serverHeader = openaiProbe.res.headers.get('server') || '';

            // Heuristics based on Headers and Data
            if (serverHeader.toLowerCase().includes("uvicorn")) service = "vLLM / FastChat (Uvicorn)";
            else if (serverHeader.toLowerCase().includes("lm studio")) service = "LM Studio";
            else service = "OpenAI Compatible API";

            // Refine based on data structure
            if (data.object === 'list') {
                details.models = Array.isArray(data.data) ? data.data.length : 0;
            }
            return { service, details };
        } catch { }
    }

    // 3. Documentation / Schema hints (FastAPI/Swagger)
    const docsProbe = results.find(r => r?.probe.path === '/docs' || r?.probe.path === '/openapi.json');
    if (docsProbe && docsProbe.res.ok) {
        service = "API Server (Likely FastAPI/Python)";
        details.docs = docsProbe.probe.path;
    }

    // 4. Generic Server Header Check
    const anyOk = results.find(r => r?.res.ok);
    if (anyOk) {
        const server = anyOk.res.headers.get('server');
        if (server) details.serverHeader = server;

        if (server?.includes("Werkzeug")) service = "Python/Flask Server";
        if (server?.includes("nginx")) service = "Nginx Web Server";
    }

    return { service, details };
}

export async function scanTarget(ip: string): Promise<ServiceScanResult[]> {
    const results: ServiceScanResult[] = [];

    // Parallel port checks for speed
    const portChecks = COMMON_LLM_PORTS.map(async (port) => {
        const isOpen = await checkPort(ip, port);
        if (isOpen) {
            const fingerprint = await probeService(ip, port);
            return {
                ip,
                port,
                open: true,
                service: fingerprint?.service || "Unknown Service",
                details: fingerprint?.details
            };
        }
        return null;
    });

    const scanResults = await Promise.all(portChecks);
    return scanResults.filter(r => r !== null) as any;
}
