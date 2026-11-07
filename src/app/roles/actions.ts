'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { PERMISSIONS, ROLES } from '@/lib/authorization';

export type RolePermissionsState = { error?: string; success?: string };

export async function saveRolePermissionsAction(
    _state: RolePermissionsState,
    formData: FormData,
): Promise<RolePermissionsState> {
    await requirePermission('ROLES_MANAGE');

    const updates = ROLES.flatMap((role) => PERMISSIONS.map((permission) => {
        const protectedPermission = role === 'ADMIN' && permission === 'ROLES_MANAGE';
        const allowed = protectedPermission || formData.get(`${role}:${permission}`) === 'on';
        return prisma.rolePermission.upsert({
            where: { role_permission: { role, permission } },
            update: { allowed },
            create: { role, permission, allowed },
        });
    }));

    await prisma.$transaction(updates);
    revalidatePath('/', 'layout');
    revalidatePath('/roles');
    return { success: 'Role permissions updated.' };
}
