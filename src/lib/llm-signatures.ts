// LLM Service Signatures with Model Extraction Paths
// Inspired by Julius/Flagwise detection patterns

export interface LLMSignature {
    provider: string;
    displayName: string;
    probes: ProbeDefinition[];
    modelExtraction?: ModelExtraction;
}

export interface ProbeDefinition {
    path: string;
    method: 'GET' | 'POST';
    expectedStatus?: number;
    matchPatterns?: string[];  // Text patterns to match in response
    headers?: Record<string, string>;
}

export interface ModelExtraction {
    endpoint: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    jsonPath: string;  // JSONPath expression to extract model names
    transform?: 'array' | 'single';
}

export const LLM_SIGNATURES: LLMSignature[] = [
    {
        provider: 'ollama',
        displayName: 'Ollama',
        probes: [
            { path: '/', method: 'GET', matchPatterns: ['Ollama is running'] },
            { path: '/api/tags', method: 'GET' },
            { path: '/api/version', method: 'GET' }
        ],
        modelExtraction: {
            endpoint: '/api/tags',
            method: 'GET',
            jsonPath: '$.models[*].name',
            transform: 'array'
        }
    },
    {
        provider: 'openai',
        displayName: 'OpenAI Compatible API',
        probes: [
            { path: '/v1/models', method: 'GET' },
            { path: '/v1/chat/completions', method: 'POST' }
        ],
        modelExtraction: {
            endpoint: '/v1/models',
            method: 'GET',
            jsonPath: '$.data[*].id',
            transform: 'array'
        }
    },
    {
        provider: 'vllm',
        displayName: 'vLLM',
        probes: [
            { path: '/v1/models', method: 'GET' },
            { path: '/health', method: 'GET' }
        ],
        modelExtraction: {
            endpoint: '/v1/models',
            method: 'GET',
            jsonPath: '$.data[*].id',
            transform: 'array'
        }
    },
    {
        provider: 'lmstudio',
        displayName: 'LM Studio',
        probes: [
            { path: '/v1/models', method: 'GET' }
        ],
        modelExtraction: {
            endpoint: '/v1/models',
            method: 'GET',
            jsonPath: '$.data[*].id',
            transform: 'array'
        }
    },
    {
        provider: 'llamacpp',
        displayName: 'llama.cpp Server',
        probes: [
            { path: '/health', method: 'GET' },
            { path: '/props', method: 'GET' }
        ],
        modelExtraction: {
            endpoint: '/props',
            method: 'GET',
            jsonPath: '$.default_generation_settings.model',
            transform: 'single'
        }
    },
    {
        provider: 'textgenwebui',
        displayName: 'Text Generation WebUI',
        probes: [
            { path: '/api/v1/model', method: 'GET' }
        ],
        modelExtraction: {
            endpoint: '/api/v1/model',
            method: 'GET',
            jsonPath: '$.result',
            transform: 'single'
        }
    },
    {
        provider: 'huggingface',
        displayName: 'HuggingFace TGI',
        probes: [
            { path: '/info', method: 'GET' },
            { path: '/health', method: 'GET' }
        ],
        modelExtraction: {
            endpoint: '/info',
            method: 'GET',
            jsonPath: '$.model_id',
            transform: 'single'
        }
    },
    {
        provider: 'anthropic',
        displayName: 'Anthropic API',
        probes: [
            { path: '/v1/messages', method: 'POST', headers: { 'anthropic-version': '2023-06-01' } }
        ]
        // No model extraction - requires auth
    },
    {
        provider: 'localai',
        displayName: 'LocalAI',
        probes: [
            { path: '/v1/models', method: 'GET' },
            { path: '/models/available', method: 'GET' }
        ],
        modelExtraction: {
            endpoint: '/v1/models',
            method: 'GET',
            jsonPath: '$.data[*].id',
            transform: 'array'
        }
    }
];

// Get signature by provider name
export function getSignature(provider: string): LLMSignature | undefined {
    return LLM_SIGNATURES.find(s =>
        s.provider.toLowerCase() === provider.toLowerCase() ||
        s.displayName.toLowerCase().includes(provider.toLowerCase())
    );
}

// Match service name to signature
export function matchSignature(serviceName: string): LLMSignature | undefined {
    const lower = serviceName.toLowerCase();
    return LLM_SIGNATURES.find(s =>
        lower.includes(s.provider) ||
        lower.includes(s.displayName.toLowerCase())
    );
}
