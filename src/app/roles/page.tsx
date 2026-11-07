import { SlidersHorizontal } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { getAllRolePermissions } from '@/lib/permissions';
import { RolePermissionsForm } from '@/components/auth/RolePermissionsForm';

export default async function RolesPage() {
    await requirePermission('ROLES_MANAGE');
    const permissions = await getAllRolePermissions();

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><SlidersHorizontal className="h-6 w-6" /></div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
                    <p className="text-muted-foreground">Control which product areas and actions are available to each workspace role.</p>
                </div>
            </div>
            <RolePermissionsForm initialPermissions={permissions} />
        </div>
    );
}
