'use client';

import { useActionState, useState } from 'react';
import { LockKeyhole, Save } from 'lucide-react';
import { saveRolePermissionsAction, RolePermissionsState } from '@/app/roles/actions';
import {
    PERMISSION_GROUPS,
    Permission,
    ROLE_LABELS,
    ROLES,
    UserRole,
} from '@/lib/authorization';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const initialState: RolePermissionsState = {};

export function RolePermissionsForm({ initialPermissions }: { initialPermissions: Record<UserRole, Permission[]> }) {
    const [state, action, pending] = useActionState(saveRolePermissionsAction, initialState);
    const [permissions, setPermissions] = useState(initialPermissions);

    function toggle(role: UserRole, permission: Permission) {
        if (role === 'ADMIN' && permission === 'ROLES_MANAGE') return;
        setPermissions((current) => ({
            ...current,
            [role]: current[role].includes(permission)
                ? current[role].filter((item) => item !== permission)
                : [...current[role], permission],
        }));
    }

    return (
        <form action={action} className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-3">
                {ROLES.map((role) => (
                    <Card key={role} className="overflow-hidden">
                        <CardHeader className="border-b bg-muted/30">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <CardTitle>{ROLE_LABELS[role]}</CardTitle>
                                    <CardDescription>{permissions[role].length} of {PERMISSION_GROUPS.flatMap((group) => group.permissions).length} permissions enabled</CardDescription>
                                </div>
                                <Badge variant={role === 'ADMIN' ? 'default' : 'secondary'}>{role}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 p-5">
                            {PERMISSION_GROUPS.map((group) => (
                                <section key={group.label} className="space-y-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h3>
                                    <div className="space-y-2">
                                        {group.permissions.map((item) => {
                                            const checked = permissions[role].includes(item.key);
                                            const locked = role === 'ADMIN' && item.key === 'ROLES_MANAGE';
                                            return (
                                                <label key={item.key} className="flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
                                                    <input
                                                        type="checkbox"
                                                        name={`${role}:${item.key}`}
                                                        checked={checked}
                                                        disabled={locked}
                                                        onChange={() => toggle(role, item.key)}
                                                        className="mt-1 h-4 w-4 accent-primary"
                                                    />
                                                    {locked && <input type="hidden" name={`${role}:${item.key}`} value="on" />}
                                                    <span className="min-w-0 flex-1">
                                                        <span className="flex items-center gap-1.5 text-sm font-medium">
                                                            {item.label}
                                                            {locked && <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" />}
                                                        </span>
                                                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.description}</span>
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur">
                <div>
                    {state.error && <p className="text-sm text-red-600">{state.error}</p>}
                    {state.success && <p className="text-sm text-green-600">{state.success}</p>}
                    {!state.error && !state.success && <p className="text-sm text-muted-foreground">Changes apply to navigation, page access, and protected server actions.</p>}
                </div>
                <Button type="submit" disabled={pending}>
                    <Save className="h-4 w-4" />
                    {pending ? 'Saving…' : 'Save permissions'}
                </Button>
            </div>
        </form>
    );
}
