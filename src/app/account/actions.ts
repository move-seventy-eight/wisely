'use server';

import prisma from '@/lib/db';
import { createSession, hashPassword, requireUser, verifyPassword } from '@/lib/auth';
import { validateStrongPassword } from '@/lib/password-policy';

export type PasswordActionState = { error?: string; success?: string };

export async function changePasswordAction(_state: PasswordActionState, formData: FormData): Promise<PasswordActionState> {
    const user = await requireUser();
    const currentPassword = String(formData.get('currentPassword') || '');
    const newPassword = String(formData.get('newPassword') || '');
    const confirmation = String(formData.get('confirmation') || '');

    const storedUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!storedUser || !await verifyPassword(currentPassword, storedUser.passwordHash)) {
        return { error: 'Current password is incorrect.' };
    }
    const passwordError = validateStrongPassword(newPassword, { email: user.email, name: user.name });
    if (passwordError) return { error: passwordError };
    if (newPassword !== confirmation) return { error: 'New password confirmation does not match.' };
    if (await verifyPassword(newPassword, storedUser.passwordHash)) return { error: 'New password must be different from the current password.' };

    await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } }),
        prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
    await createSession(user.id);

    return { success: 'Password changed and all other sessions were revoked.' };
}
