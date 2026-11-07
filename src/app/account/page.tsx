import { KeyRound, UserCircle } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/authorization';
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AccountPage() {
    const user = await requireUser();

    return (
        <div className="max-w-4xl space-y-8">
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><UserCircle className="h-6 w-6" /></div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Account</h1>
                    <p className="text-muted-foreground">Manage your profile and security settings.</p>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Full name</p><p className="mt-1 font-medium">{user.name}</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p><p className="mt-1 font-medium">{user.email}</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p><Badge className="mt-1">{ROLE_LABELS[user.role]}</Badge></div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Change password</CardTitle>
                    <CardDescription>Changing your password refreshes this session and revokes all other sessions.</CardDescription>
                </CardHeader>
                <CardContent><ChangePasswordForm /></CardContent>
            </Card>
        </div>
    );
}
