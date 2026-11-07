'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import prisma from '@/lib/db';
import {
    createSession,
    destroySession,
    hashPassword,
    isValidEmail,
    normalizeEmail,
    verifyPassword,
} from '@/lib/auth';
import { validateStrongPassword } from '@/lib/password-policy';
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/rate-limiter';

export type AuthActionState = { error?: string };

// Static dummy hash to consume identical scrypt cycles if user does not exist (prevents timing attacks)
const DUMMY_HASH = 'scrypt$0123456789abcdef0123456789abcdef$0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function safeNextPath(value: FormDataEntryValue | null) {
    if (typeof value !== 'string') return '/';
    const trimmed = value.trim();
    // Strictly allow single leading slash paths without protocol prefixes or backslash traversal
    if (/^\/[a-zA-Z0-9_\-?&=%/.]*$/.test(trimmed) && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
        return trimmed;
    }
    return '/';
}

export async function loginAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
    const email = normalizeEmail(String(formData.get('email') || ''));
    const password = String(formData.get('password') || '');
    const next = safeNextPath(formData.get('next'));

    // Enforce rate limiting per client IP and email
    const headerList = await headers();
    const clientIp = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client';
    const rateLimitKey = `login:${clientIp}:${email}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);

    if (!rateLimit.allowed) {
        return {
            error: `Too many failed login attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`
        };
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Timing-attack mitigation: always compute scrypt verification even if account does not exist
    const hashToVerify = user ? user.passwordHash : DUMMY_HASH;
    const passwordMatches = await verifyPassword(password, hashToVerify);

    if (!user || !passwordMatches || !user.active) {
        recordFailedAttempt(rateLimitKey, 15 * 60 * 1000);
        return { error: 'Invalid email or password.' };
    }

    resetRateLimit(rateLimitKey);
    await createSession(user.id);
    redirect(next);
}

export async function setupAdminAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
        return { error: 'The initial administrator account has already been created.' };
    }

    const name = String(formData.get('name') || '').trim();
    const email = normalizeEmail(String(formData.get('email') || ''));
    const password = String(formData.get('password') || '');

    if (name.length < 2) return { error: 'Name must be at least 2 characters.' };
    if (!isValidEmail(email)) return { error: 'Enter a valid email address.' };
    const passwordError = validateStrongPassword(password, { email, name });
    if (passwordError) return { error: passwordError };

    // Atomically prevent concurrent setup race condition
    try {
        await prisma.$transaction(async (tx) => {
            const count = await tx.user.count();
            if (count > 0) {
                throw new Error('ALREADY_INITIALIZED');
            }
            return tx.user.create({
                data: {
                    name,
                    email,
                    passwordHash: await hashPassword(password),
                    role: 'ADMIN',
                },
            });
        });
    } catch (e: any) {
        if (e.message === 'ALREADY_INITIALIZED') {
            return { error: 'The initial administrator account has already been created.' };
        }
        throw e;
    }

    const createdUser = await prisma.user.findUnique({ where: { email } });
    if (createdUser) {
        await createSession(createdUser.id);
    }
    redirect('/');
}

export async function logoutAction() {
    await destroySession();
    redirect('/login');
}
