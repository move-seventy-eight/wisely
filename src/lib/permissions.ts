import 'server-only';

import prisma from './db';
import {
    DEFAULT_ROLE_PERMISSIONS,
    isUserRole,
    PERMISSIONS,
    Permission,
    UserRole,
} from './authorization';

export async function getRolePermissions(role: UserRole): Promise<Permission[]> {
    const overrides = await prisma.rolePermission.findMany({ where: { role } });
    if (overrides.length === 0) return DEFAULT_ROLE_PERMISSIONS[role];

    const overrideMap = new Map(overrides.map((entry) => [entry.permission, entry.allowed]));
    const permissions = PERMISSIONS.filter((permission) => overrideMap.get(permission) ?? DEFAULT_ROLE_PERMISSIONS[role].includes(permission));
    if (role === 'ADMIN' && !permissions.includes('ROLES_MANAGE')) permissions.push('ROLES_MANAGE');
    return permissions;
}

export async function getAllRolePermissions() {
    const rows = await prisma.rolePermission.findMany();
    const rowsByRole = new Map<UserRole, Map<string, boolean>>();

    for (const row of rows) {
        if (!isUserRole(row.role)) continue;
        if (!rowsByRole.has(row.role)) rowsByRole.set(row.role, new Map());
        rowsByRole.get(row.role)!.set(row.permission, row.allowed);
    }

    return (['ADMIN', 'ANALYST', 'VIEWER'] as UserRole[]).reduce((result, role) => {
        const overrides = rowsByRole.get(role);
        result[role] = PERMISSIONS.filter((permission) => overrides?.get(permission) ?? DEFAULT_ROLE_PERMISSIONS[role].includes(permission));
        if (role === 'ADMIN' && !result[role].includes('ROLES_MANAGE')) result[role].push('ROLES_MANAGE');
        return result;
    }, {} as Record<UserRole, Permission[]>);
}
