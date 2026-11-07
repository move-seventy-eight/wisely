const CISCO_LEADERBOARD_API = 'https://leaderboard.aidefense.cisco.com/api/rankings?limit=500&offset=0';

export const CISCO_LEADERBOARD_URL = 'https://leaderboard.aidefense.cisco.com/rankings';

export type CiscoSecurityGrade = 'Excellent' | 'Good' | 'Fair' | 'Poor';

export interface CiscoLeaderboardEntry {
    model: string;
    validation_score: number;
    multi_turn_resistance: number;
    combined_score: number;
    source_type: 'open_source' | 'closed_source' | string;
}

export interface CiscoModelScoreMatch extends CiscoLeaderboardEntry {
    rank: number;
    grade: CiscoSecurityGrade;
    detectedModel: string;
}

interface CiscoLeaderboardResponse {
    data?: unknown;
}

const PROVIDER_PREFIXES = new Set([
    'amazon',
    'anthropic',
    'cohere',
    'deepseek',
    'google',
    'meta',
    'minimax',
    'mistral',
    'moonshot',
    'openai',
    'qwen',
    'xai',
]);

const NOISE_TOKENS = new Set([
    'chat',
    'instruct',
    'it',
    'latest',
    'preview',
]);

export function getCiscoSecurityGrade(score: number): CiscoSecurityGrade {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
}

export function normalizeModelName(modelName: string): string {
    const finalPathSegment = modelName.trim().split('/').filter(Boolean).at(-1) || modelName;
    const normalized = finalPathSegment
        .toLowerCase()
        .replace(/([a-z])([0-9])/g, '$1 $2')
        .replace(/[._:/-]+/g, ' ')
        .replace(/\b\d{8}\b/g, ' ')
        .replace(/\bq\d+(?:\s+[a-z]){0,2}\b/g, ' ')
        .replace(/\b(?:fp|bf)\d+\b/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const tokens = normalized.split(' ').filter(Boolean);
    if (tokens.length > 1 && PROVIDER_PREFIXES.has(tokens[0])) tokens.shift();

    return tokens.filter((token) => !NOISE_TOKENS.has(token)).join(' ');
}

function isLeaderboardEntry(value: unknown): value is CiscoLeaderboardEntry {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Record<string, unknown>;
    return typeof entry.model === 'string'
        && typeof entry.validation_score === 'number'
        && typeof entry.multi_turn_resistance === 'number'
        && typeof entry.combined_score === 'number'
        && typeof entry.source_type === 'string';
}

export const FALLBACK_CISCO_LEADERBOARD: CiscoLeaderboardEntry[] = [
    { model: 'Claude Opus 4.5', validation_score: 97.8, multi_turn_resistance: 88.8, combined_score: 93.3, source_type: 'closed_source' },
    { model: 'Claude 3.5 Sonnet', validation_score: 89.2, multi_turn_resistance: 83.0, combined_score: 86.1, source_type: 'closed_source' },
    { model: 'Claude 3 Sonnet', validation_score: 91.5, multi_turn_resistance: 88.8, combined_score: 90.2, source_type: 'closed_source' },
    { model: 'Claude 3.5 Haiku', validation_score: 88.4, multi_turn_resistance: 81.2, combined_score: 84.8, source_type: 'closed_source' },
    { model: 'GPT-4o', validation_score: 85.6, multi_turn_resistance: 78.9, combined_score: 82.3, source_type: 'closed_source' },
    { model: 'GPT-4o mini', validation_score: 84.1, multi_turn_resistance: 77.2, combined_score: 80.7, source_type: 'closed_source' },
    { model: 'Llama 3.1 70B Instruct', validation_score: 86.4, multi_turn_resistance: 82.1, combined_score: 84.3, source_type: 'open_source' },
    { model: 'Llama 3.1 8B Instruct', validation_score: 82.0, multi_turn_resistance: 74.5, combined_score: 78.3, source_type: 'open_source' },
    { model: 'Llama 3.3 70B Instruct', validation_score: 85.9, multi_turn_resistance: 81.0, combined_score: 83.5, source_type: 'open_source' },
    { model: 'DeepSeek R1', validation_score: 76.5, multi_turn_resistance: 70.4, combined_score: 73.5, source_type: 'open_source' },
    { model: 'DeepSeek V3.2', validation_score: 74.2, multi_turn_resistance: 68.9, combined_score: 71.6, source_type: 'open_source' },
    { model: 'Mistral Large 2.0', validation_score: 81.8, multi_turn_resistance: 76.3, combined_score: 79.1, source_type: 'closed_source' },
    { model: 'Gemini 2.5 Flash', validation_score: 83.7, multi_turn_resistance: 77.8, combined_score: 80.8, source_type: 'closed_source' },
    { model: 'Gemini 2.5 Pro', validation_score: 84.5, multi_turn_resistance: 79.1, combined_score: 81.8, source_type: 'closed_source' },
    { model: 'Grok 3', validation_score: 74.0, multi_turn_resistance: 69.5, combined_score: 71.8, source_type: 'closed_source' },
    { model: 'Phi-4', validation_score: 77.3, multi_turn_resistance: 71.2, combined_score: 74.3, source_type: 'open_source' },
    { model: 'Command R+', validation_score: 75.1, multi_turn_resistance: 70.0, combined_score: 72.6, source_type: 'closed_source' },
];

export async function getCiscoLeaderboard(): Promise<CiscoLeaderboardEntry[]> {
    try {
        const response = await fetch(CISCO_LEADERBOARD_API, {
            headers: { Accept: 'application/json' },
            next: { revalidate: 21600 },
            signal: AbortSignal.timeout(6000),
        });

        if (!response.ok) {
            console.error(`Cisco leaderboard request failed with status ${response.status}, using fallback rankings`);
            return FALLBACK_CISCO_LEADERBOARD;
        }

        const payload = await response.json() as CiscoLeaderboardResponse;
        const liveItems = Array.isArray(payload.data) ? payload.data.filter(isLeaderboardEntry) : [];
        return liveItems.length > 0 ? liveItems : FALLBACK_CISCO_LEADERBOARD;
    } catch (error) {
        console.error('Cisco leaderboard request failed, using fallback rankings:', error);
        return FALLBACK_CISCO_LEADERBOARD;
    }
}

export function matchCiscoModel(
    detectedModel: string,
    leaderboard: CiscoLeaderboardEntry[],
): CiscoModelScoreMatch | null {
    const detectedNormalized = normalizeModelName(detectedModel);
    if (!detectedNormalized) return null;

    const normalizedEntries = leaderboard.map((entry, index) => ({
        entry,
        rank: index + 1,
        normalized: normalizeModelName(entry.model),
    }));

    let candidates = normalizedEntries.filter(({ normalized }) => normalized === detectedNormalized);

    if (candidates.length === 0) {
        const detectedTokens = detectedNormalized.split(' ');
        const containsVersionDetail = detectedTokens.some((token) => /\d/.test(token));

        if (detectedTokens.length >= 2 && containsVersionDetail) {
            candidates = normalizedEntries.filter(({ normalized }) => (
                normalized.startsWith(`${detectedNormalized} `)
                || detectedNormalized.startsWith(`${normalized} `)
            ));
        }
    }

    // Never guess when a shorthand name maps to multiple model variants.
    if (candidates.length !== 1) return null;

    const [{ entry, rank }] = candidates;
    return {
        ...entry,
        rank,
        grade: getCiscoSecurityGrade(entry.combined_score),
        detectedModel,
    };
}

export function buildCiscoModelScoreMap(
    modelNames: string[],
    leaderboard: CiscoLeaderboardEntry[],
): Record<string, CiscoModelScoreMatch | null> {
    return Object.fromEntries(
        Array.from(new Set(modelNames.filter(Boolean))).map((modelName) => [
            modelName,
            matchCiscoModel(modelName, leaderboard),
        ]),
    );
}
