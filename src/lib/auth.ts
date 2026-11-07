import 'server-only';

import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { cookies, headers } from 'next/headers';
import prisma from './db';
import { isUserRole, Permission, UserRole } from './authorization';
import { SESSION_COOKIE, DEFAULT_SESSION_MAX_AGE_SECONDS, MAX_ALLOWED_SESSION_SECONDS } from './auth-constants';
import { getRolePermissions } from './permissions';

const scrypt = promisify(scryptCallback);

// Secure session duration: 4 hours default (14,400s), configurable via SESSION_MAX_AGE_SECONDS up to 12h ceiling
const parsedSessionAge = Number(process.env.SESSION_MAX_AGE_SECONDS);
export const SESSION_MAX_AGE_SECONDS = (!isNaN(parsedSessionAge) && parsedSessionAge > 0)
    ? Math.min(parsedSessionAge, MAX_ALLOWED_SESSION_SECONDS)
    : DEFAULT_SESSION_MAX_AGE_SECONDS;

export type AuthUser = {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    active: boolean;
};

export function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
    const [algorithm, salt, encodedHash] = storedHash.split('$');
    if (algorithm !== 'scrypt' || !salt || !encodedHash) return false;

    const expected = Buffer.from(encodedHash, 'hex');
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function generateStrongPassword(length = 20) {
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const symbols = '!@#$%^&*_-+=?';
    const all = `${lower}${upper}${digits}${symbols}`;
    const characters = [
        lower[randomInt(lower.length)],
        upper[randomInt(upper.length)],
        digits[randomInt(digits.length)],
        symbols[randomInt(symbols.length)],
    ];

    while (characters.length < Math.max(length, 12)) {
        characters.push(all[randomInt(all.length)]);
    }

    for (let index = characters.length - 1; index > 0; index -= 1) {
        const swapIndex = randomInt(index + 1);
        [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
    }

    return characters.join('');
}

function hashSessionToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

    // Opportunistically prune expired sessions to keep DB clean
    try {
        await prisma.session.deleteMany({
            where: { expiresAt: { lte: new Date() } },
        });
    } catch { }

    await prisma.session.create({
        data: {
            userId,
            tokenHash: hashSessionToken(token),
            expiresAt,
        },
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
        expires: expiresAt,
    });
}

export async function destroySession() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
        await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
    }

    cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const tokenHash = hashSessionToken(token);
    const session = await prisma.session.findUnique({
        where: { tokenHash },
        include: { user: true },
    });

    if (!session) return null;

    // Strict expiration check: delete expired session and cookie immediately
    if (session.expiresAt <= new Date()) {
        try {
            await prisma.session.deleteMany({ where: { tokenHash } });
            cookieStore.delete(SESSION_COOKIE);
        } catch { }
        return null;
    }

    if (!session.user.active || !isUserRole(session.user.role)) return null;

    return {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        active: session.user.active,
    };
}

export async function requireUser() {
    const user = await getCurrentUser();
    if (!user) throw new Error('You must sign in to perform this action.');
    return user;
}

export async function requireRole(roles: UserRole[]) {
    const user = await requireUser();
    if (!roles.includes(user.role)) {
        throw new Error('You do not have permission to perform this action.');
    }
    return user;
}

export async function requirePermission(permission: Permission) {
    const user = await requireUser();
    const permissions = await getRolePermissions(user.role);
    if (!permissions.includes(permission)) {
        throw new Error('You do not have permission to perform this action.');
    }
    return user;
}

export async function requireOperatorOrSystem(permission: Permission = 'DISCOVERY_RUN') {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = (await headers()).get('authorization');

    if (cronSecret && authorization === `Bearer ${cronSecret}`) return null;
    return requirePermission(permission);
}
