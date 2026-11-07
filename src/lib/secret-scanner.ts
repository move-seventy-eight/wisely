export interface SecretFinding {
    type: string;
    description: string;
    value: string;
    nodeName: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    location?: 'input' | 'output' | 'both';
}

export interface CustomPattern {
    regex: string | RegExp;
    type: string;
    description: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

const PATTERNS = {
    AWS_ACCESS_KEY: {
        regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
        type: 'AWS_ACCESS_KEY',
        description: 'AWS Access Key ID',
        severity: 'CRITICAL'
    },
    AWS_SECRET_KEY: {
        // More prone to false positives, but useful in context
        regex: /aws_secret_access_key.{0,20}['"][0-9a-zA-Z\/+]{40}['"]/gi,
        type: 'AWS_SECRET_KEY',
        description: 'AWS Secret Access Key',
        severity: 'CRITICAL'
    },
    GENERIC_PASSWORD: {
        // Matches "password": "smth", 'password': 'smth', password=smth
        regex: /(?:password|passwd|pwd)[\s"'=:]+([^\s"']{8,})/gi,
        type: 'GENERIC_PASSWORD',
        description: 'Generic Password Field',
        severity: 'HIGH'
    },
    PRIVATE_KEY: {
        regex: /-----BEGIN (?:RSA|OPENSSH|DSA|EC|PGP) PRIVATE KEY-----[\s\S]*?-----END (?:RSA|OPENSSH|DSA|EC|PGP) PRIVATE KEY-----/g,
        type: 'PRIVATE_KEY',
        description: 'Cryptographic Private Key',
        severity: 'CRITICAL'
    },
    CREDIT_CARD: {
        // Basic matcher for typical CC patterns without validation
        regex: /\b(?:\d[\W_]*?){13,16}\b/g,
        type: 'CREDIT_CARD',
        description: 'Potential Credit Card Number',
        severity: 'HIGH'
    },
    SLACK_TOKEN: {
        regex: /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/g,
        type: 'SLACK_TOKEN',
        description: 'Slack Bot/App Token',
        severity: 'CRITICAL'
    },
    JWT: {
        // More robust JWT regex matching the eyJ prefix, dot separators, and base64url charset
        regex: /eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}/g,
        type: 'JWT_TOKEN',
        description: 'JSON Web Token (JWT)',
        severity: 'MEDIUM'
    },
    PROMPT_INJECTION: {
        regex: /(?:ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions|you\s+are\s+(?:going\s+to\s+)?act\s+as\s+a?\s*(?:DAN|jailbreak|unrestricted)|do\s+anything\s+now|from\s+now\s+on\s+you\s+(?:are|will)|forget\s+(?:all\s+)?(?:your|previous)\s+(?:instructions|rules|guidelines)|\bDAN\s+mode|bypass\s+(?:your|all|any)\s+(?:restrictions|filters|guidelines|safety)|override\s+(?:your|system)\s+(?:prompt|instructions)|disregard\s+(?:your|all|any|previous)\s+(?:instructions|rules|programming)|pretend\s+you\s+(?:are|have)\s+no\s+(?:restrictions|rules|limits)|system\s*:\s*you\s+are|reveal\s+(?:your|the)\s+(?:system|initial|original)\s+prompt|\[\s*(?:SYSTEM|INST|JAILBREAK)\s*\])/gi,
        type: 'PROMPT_INJECTION',
        description: 'Prompt Injection / Jailbreak Attempt',
        severity: 'CRITICAL'
    },
    OPENAI_API_KEY: {
        regex: /sk-(?:proj-)?[a-zA-Z0-9_-]{32,}/g,
        type: 'OPENAI_API_KEY',
        description: 'OpenAI API Secret Key',
        severity: 'CRITICAL'
    },
    ANTHROPIC_API_KEY: {
        regex: /sk-ant-[a-zA-Z0-9_-]{32,}/g,
        type: 'ANTHROPIC_API_KEY',
        description: 'Anthropic API Secret Key',
        severity: 'CRITICAL'
    },
    GENERIC_API_KEY: {
        regex: /(?:api[_-]?key|apikey|bearer_token)[\s"'=:]+([a-zA-Z0-9_\-\.]{24,})/gi,
        type: 'API_KEY',
        description: 'Hardcoded API Key',
        severity: 'HIGH'
    }
} as const;

function isFalsePositive(value: string, type: string): boolean {
    if (type === 'CREDIT_CARD') {
        // Filter out obvious timestamps, version strings, etc.
        const clean = value.replace(/[\W_]/g, '');
        if (clean.length < 13 || clean.length > 16) return true;

        // Simple Luhn check to reduce false positive noise
        let sum = 0;
        let shouldDouble = false;
        for (let i = clean.length - 1; i >= 0; i--) {
            let digit = parseInt(clean.charAt(i), 10);
            if (shouldDouble) {
                if ((digit *= 2) > 9) digit -= 9;
            }
            sum += digit;
            shouldDouble = !shouldDouble;
        }
        return (sum % 10) !== 0;
    }

    if (type === 'GENERIC_PASSWORD') {
        const lower = value.toLowerCase();
        if (lower.includes('true') || lower.includes('false') || lower.includes('null') || lower.length < 8) {
            return true;
        }
    }
    return false;
}

export function scanExecutionData(executionData: any, customPatterns: CustomPattern[] = []): SecretFinding[] {
    const findings: SecretFinding[] = [];

    if (!executionData || !executionData.data || !executionData.data.resultData || !executionData.data.resultData.runData) {
        return findings;
    }

    const runData = executionData.data.resultData.runData;

    // Compile active patterns
    const activePatterns = [
        ...Object.values(PATTERNS).map(p => ({
            ...p,
            regex: new RegExp(p.regex) // Ensure fresh regex instance
        })),
        ...customPatterns.map(p => ({
            ...p,
            regex: typeof p.regex === 'string' ? new RegExp(p.regex, 'g') : new RegExp(p.regex)
        }))
    ];

    // Traverse all nodes
    for (const [nodeName, runs] of Object.entries(runData)) {
        if (!Array.isArray(runs)) continue;

        for (const run of runs) {
            if (!run) continue;

            // Separate payload strings for input vs output to track finding origin
            const inputString = JSON.stringify(run.inputData || run.data?.input || '');
            const outputString = JSON.stringify(run.data?.main || '');
            const fullPayloadString = JSON.stringify(run);

            for (const pattern of activePatterns) {
                pattern.regex.lastIndex = 0;

                let match;
                while ((match = pattern.regex.exec(fullPayloadString)) !== null) {
                    const matchValue = match[1] ? match[1] : match[0];

                    if (!isFalsePositive(matchValue, pattern.type)) {
                        const inInput = inputString.includes(matchValue);
                        const inOutput = outputString.includes(matchValue);

                        let location: 'input' | 'output' | 'both' = 'input';
                        if (inInput && inOutput) location = 'both';
                        else if (inOutput && !inInput) location = 'output';
                        else location = 'input';

                        // Avoid duplicate findings for same value on same node
                        if (!findings.some(f => f.nodeName === nodeName && f.value === matchValue && f.type === pattern.type)) {
                            findings.push({
                                type: pattern.type,
                                description: pattern.description,
                                value: matchValue,
                                nodeName: nodeName,
                                severity: pattern.severity,
                                location: location
                            });
                        }
                    }
                }
            }
        }
    }

    return findings;
}
