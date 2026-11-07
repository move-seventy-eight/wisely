// Shadow AI Detection Engine
// Flagwise-style pattern matching and risk scoring
// Note: These are pure utility functions, not Server Actions

export interface DetectionMatch {
    ruleName: string;
    ruleType: string;
    severity: string;
    points: number;
    matchedText?: string;
}

export interface AnalysisResult {
    riskScore: number;
    isFlagged: boolean;
    matches: DetectionMatch[];
}

// Default detection patterns
const DEFAULT_PATTERNS = {
    creditCard: {
        name: 'Credit Card Number',
        regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        severity: 'critical',
        points: 75
    },
    ssn: {
        name: 'Social Security Number',
        regex: /\b\d{3}-\d{2}-\d{4}\b/g,
        severity: 'critical',
        points: 80
    },
    apiKey: {
        name: 'API Key Leak',
        regex: /(sk-[a-zA-Z0-9]{20,}|api[_-]?key[=:]["']?[a-zA-Z0-9]{20,})/gi,
        severity: 'high',
        points: 60
    },
    awsKey: {
        name: 'AWS Access Key',
        regex: /AKIA[0-9A-Z]{16}/g,
        severity: 'critical',
        points: 90
    },
    privateKey: {
        name: 'Private Key',
        regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
        severity: 'critical',
        points: 95
    },
    email: {
        name: 'Email Address',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        severity: 'low',
        points: 5
    },
    ipAddress: {
        name: 'Internal IP Address',
        regex: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
        severity: 'medium',
        points: 15
    }
};

// Sensitive keywords
const SENSITIVE_KEYWORDS = [
    { word: 'password', severity: 'medium', points: 20 },
    { word: 'secret', severity: 'medium', points: 20 },
    { word: 'credential', severity: 'medium', points: 20 },
    { word: 'token', severity: 'low', points: 10 },
    { word: 'bearer', severity: 'medium', points: 25 },
    { word: 'authorization', severity: 'low', points: 10 },
    { word: 'private', severity: 'low', points: 5 },
    { word: 'confidential', severity: 'medium', points: 15 },
    { word: 'internal only', severity: 'medium', points: 20 },
    { word: 'do not share', severity: 'high', points: 30 },
];

// Blocked/restricted models (can be configured)
const RESTRICTED_MODELS: string[] = [
    // Example: companies might want to block certain models
    // 'gpt-4-turbo',
    // 'claude-3-opus',
];

/**
 * Analyze text content for sensitive data and policy violations
 */
export function analyzeContent(content: string, customRules?: any[]): AnalysisResult {
    const matches: DetectionMatch[] = [];
    let totalPoints = 0;

    // Check default patterns
    for (const [key, pattern] of Object.entries(DEFAULT_PATTERNS)) {
        const regexMatches = content.match(pattern.regex);
        if (regexMatches && regexMatches.length > 0) {
            matches.push({
                ruleName: pattern.name,
                ruleType: 'regex',
                severity: pattern.severity,
                points: pattern.points,
                matchedText: regexMatches[0].substring(0, 20) + '...' // Truncate for privacy
            });
            totalPoints += pattern.points;
        }
    }

    // Check sensitive keywords
    const lowerContent = content.toLowerCase();
    for (const keyword of SENSITIVE_KEYWORDS) {
        if (lowerContent.includes(keyword.word)) {
            matches.push({
                ruleName: `Keyword: ${keyword.word}`,
                ruleType: 'keyword',
                severity: keyword.severity,
                points: keyword.points
            });
            totalPoints += keyword.points;
        }
    }

    // Check custom rules if provided
    if (customRules) {
        for (const rule of customRules) {
            if (!rule.enabled) continue;

            let matched = false;
            if (rule.type === 'regex') {
                try {
                    const regex = new RegExp(rule.pattern, 'gi');
                    matched = regex.test(content);
                } catch (e) {
                    // Invalid regex, skip
                }
            } else if (rule.type === 'keyword') {
                matched = lowerContent.includes(rule.pattern.toLowerCase());
            }

            if (matched) {
                matches.push({
                    ruleName: rule.name,
                    ruleType: rule.type,
                    severity: rule.severity,
                    points: rule.points
                });
                totalPoints += rule.points;
            }
        }
    }

    // Normalize score to 0-100
    const riskScore = Math.min(100, totalPoints);
    const isFlagged = riskScore >= 50; // Flag if score >= 50

    return {
        riskScore,
        isFlagged,
        matches
    };
}

/**
 * Check if a model is restricted
 */
export function isModelRestricted(model: string, blockedModels?: string[]): boolean {
    const blocked = blockedModels || RESTRICTED_MODELS;
    return blocked.some(m => model.toLowerCase().includes(m.toLowerCase()));
}

/**
 * Hash content for privacy-preserving storage
 */
export function hashContent(content: string): string {
    // Simple hash for demo - in production use crypto
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

/**
 * Get severity color for UI
 */
export function getSeverityColor(severity: string): string {
    switch (severity) {
        case 'critical': return 'text-red-600 bg-red-500/10';
        case 'high': return 'text-orange-600 bg-orange-500/10';
        case 'medium': return 'text-yellow-600 bg-yellow-500/10';
        case 'low': return 'text-blue-600 bg-blue-500/10';
        default: return 'text-gray-600 bg-gray-500/10';
    }
}
