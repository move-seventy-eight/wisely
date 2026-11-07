'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { hashPassword, isValidEmail, normalizeEmail, requirePermission } from '@/lib/auth';
import { isUserRole } from '@/lib/authorization';
import { validateStrongPassword } from '@/lib/password-policy';

export type UserActionState = { error?: string; success?: string };

async function assertAdminContinuity(userId: string, nextRole?: string, nextActive?: boolean) {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error('User not found.');

    const removesActiveAdmin = target.role === 'ADMIN'
        && target.active
        && (nextRole !== undefined && nextRole !== 'ADMIN' || nextActive === false);

    if (removesActiveAdmin) {
        const activeAdminCount = await prisma.user.count({ where: { role: 'ADMIN', active: true } });
        if (activeAdminCount <= 1) throw new Error('The last active administrator cannot be demoted or deactivated.');
    }

    return target;
}

export async function createUserAction(_state: UserActionState, formData: FormData): Promise<UserActionState> {
    await requirePermission('USERS_MANAGE');

    const name = String(formData.get('name') || '').trim();
    const email = normalizeEmail(String(formData.get('email') || ''));
    const password = String(formData.get('password') || '');
    const role = String(formData.get('role') || 'VIEWER');

    if (name.length < 2) return { error: 'Name must be at least 2 characters.' };
    if (!isValidEmail(email)) return { error: 'Enter a valid email address.' };
    const passwordError = validateStrongPassword(password, { email, name });
    if (passwordError) return { error: passwordError };
    if (!isUserRole(role)) return { error: 'Invalid role.' };
    if (await prisma.user.findUnique({ where: { email } })) return { error: 'This email address is already registered.' };

    await prisma.user.create({
        data: { name, email, passwordHash: await hashPassword(password), role },
    });

    revalidatePath('/users');
    return { success: 'User created.' };
}

export async function updateUserRoleAction(formData: FormData) {
    const currentUser = await requirePermission('USERS_MANAGE');
    const userId = String(formData.get('userId') || '');
    const role = String(formData.get('role') || '');
    if (!isUserRole(role)) throw new Error('Invalid role.');
    if (currentUser.id === userId && role !== 'ADMIN') throw new Error('You cannot remove your own administrator role.');

    await assertAdminContinuity(userId, role, undefined);
    await prisma.user.update({ where: { id: userId }, data: { role } });
    revalidatePath('/users');
}

export async function toggleUserActiveAction(formData: FormData) {
    const currentUser = await requirePermission('USERS_MANAGE');
    const userId = String(formData.get('userId') || '');
    const active = String(formData.get('active')) === 'true';
    if (currentUser.id === userId && !active) throw new Error('You cannot deactivate your own account.');

    await assertAdminContinuity(userId, undefined, active);
    await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { active } }),
        ...(!active ? [prisma.session.deleteMany({ where: { userId } })] : []),
    ]);
    revalidatePath('/users');
}

export async function revokeUserSessionsAction(formData: FormData) {
    const currentUser = await requirePermission('USERS_MANAGE');
    const userId = String(formData.get('userId') || '');
    if (currentUser.id === userId) throw new Error('Manage your own sessions from the My Account page.');

    await prisma.session.deleteMany({ where: { userId } });
    revalidatePath('/users');
}
