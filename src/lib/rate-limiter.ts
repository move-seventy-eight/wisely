/**
 * In-memory sliding window rate limiter for security-sensitive operations (login, setup, auth).
 */

interface RateLimitRecord {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitRecord>();

// Opportunistic cleanup interval
if (typeof setInterval !== 'undefined') {
    const timer = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of store.entries()) {
            if (record.resetAt <= now) {
                store.delete(key);
            }
        }
    }, 5 * 60 * 1000);
    timer.unref?.();
}

export function checkRateLimit(
    key: string,
    maxAttempts = 5,
    windowMs = 15 * 60 * 1000
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const record = store.get(key);

    if (!record || record.resetAt <= now) {
        return { allowed: true, remaining: maxAttempts, retryAfterSeconds: 0 };
    }

    if (record.count >= maxAttempts) {
        const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
        return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    return {
        allowed: true,
        remaining: maxAttempts - record.count,
        retryAfterSeconds: 0,
    };
}

export function recordFailedAttempt(
    key: string,
    windowMs = 15 * 60 * 1000
): void {
    const now = Date.now();
    const record = store.get(key);

    if (!record || record.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
    } else {
        record.count += 1;
    }
}

export function resetRateLimit(key: string): void {
    store.delete(key);
}
