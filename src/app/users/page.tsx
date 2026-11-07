import { ShieldCheck, Users } from 'lucide-react';
import prisma from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { ROLE_LABELS, UserRole } from '@/lib/authorization';
import { CreateUserForm } from '@/components/auth/CreateUserForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { revokeUserSessionsAction, toggleUserActiveAction, updateUserRoleAction } from './actions';

export default async function UsersPage() {
    const currentUser = await requirePermission('USERS_MANAGE');
    const users = await prisma.user.findMany({
        orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
        include: {
            _count: {
                select: { sessions: { where: { expiresAt: { gt: new Date() } } } },
            },
        },
    });

    return (
        <div className="space-y-8">
            <div>
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Users className="h-6 w-6" /></div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Users and roles</h1>
                        <p className="text-muted-foreground">Manage access levels, account status, and active sessions.</p>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>New user</CardTitle>
                    <CardDescription>Users can change their temporary password from My Account after signing in.</CardDescription>
                </CardHeader>
                <CardContent><CreateUserForm /></CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Workspace members</CardTitle>
                    <CardDescription>{users.length} registered {users.length === 1 ? 'user' : 'users'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {users.map((user) => (
                        <div key={user.id} className="grid gap-4 rounded-xl border p-4 lg:grid-cols-[1.4fr_0.8fr_0.6fr_1fr] lg:items-center">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                                    {user.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate font-medium">{user.name}</p>
                                        {user.id === currentUser.id && <Badge variant="secondary">You</Badge>}
                                    </div>
                                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                                </div>
                            </div>

                            <form action={updateUserRoleAction} className="flex gap-2">
                                <input type="hidden" name="userId" value={user.id} />
                                <select name="role" defaultValue={user.role} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm">
                                    {(['ADMIN', 'ANALYST', 'VIEWER'] as UserRole[]).map((role) => (
                                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                                    ))}
                                </select>
                                <Button type="submit" size="sm" variant="outline">Save</Button>
                            </form>

                            <div className="space-y-1 text-sm">
                                <Badge variant={user.active ? 'default' : 'secondary'}>{user.active ? 'Active' : 'Inactive'}</Badge>
                                <p className="text-xs text-muted-foreground">{user._count.sessions} active {user._count.sessions === 1 ? 'session' : 'sessions'}</p>
                            </div>

                            <div className="flex flex-wrap justify-end gap-2">
                                <form action={toggleUserActiveAction}>
                                    <input type="hidden" name="userId" value={user.id} />
                                    <input type="hidden" name="active" value={String(!user.active)} />
                                    <Button type="submit" size="sm" variant={user.active ? 'outline' : 'default'} disabled={user.id === currentUser.id}>
                                        {user.active ? 'Deactivate' : 'Activate'}
                                    </Button>
                                </form>
                                <form action={revokeUserSessionsAction}>
                                    <input type="hidden" name="userId" value={user.id} />
                                    <Button type="submit" size="sm" variant="ghost" disabled={user.id === currentUser.id || user._count.sessions === 0}>
                                        Revoke sessions
                                    </Button>
                                </form>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
                {([
                    ['ADMIN', 'Full access to every page, settings, and user management.'],
                    ['ANALYST', 'Scanning and analysis access, excluding users, settings, and credentials.'],
                    ['VIEWER', 'Read-only access to approved inventory, workflow, and security reports.'],
                ] as const).map(([role, description]) => (
                    <div key={role} className="rounded-xl border bg-card p-4">
                        <div className="mb-2 flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-primary" />{ROLE_LABELS[role]}</div>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
