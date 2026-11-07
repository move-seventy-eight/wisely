'use client';

import { useActionState } from 'react';
import { UserPlus } from 'lucide-react';
import { createUserAction, UserActionState } from '@/app/users/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: UserActionState = {};

export function CreateUserForm() {
    const [state, action, pending] = useActionState(createUserAction, initialState);

    return (
        <form action={action} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
                <Label htmlFor="new-user-name">Full name</Label>
                <Input id="new-user-name" name="name" required minLength={2} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="new-user-email">Email</Label>
                <Input id="new-user-email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="new-user-password">Temporary password</Label>
                <Input id="new-user-password" name="password" type="password" required minLength={12} maxLength={128} />
                <p className="text-xs text-muted-foreground">12+ characters with uppercase, lowercase, number, and symbol.</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="new-user-role">Role</Label>
                <select id="new-user-role" name="role" defaultValue="VIEWER" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="ADMIN">Administrator</option>
                    <option value="ANALYST">Analyst</option>
                    <option value="VIEWER">Viewer</option>
                </select>
            </div>
            <div className="flex items-center gap-3 md:col-span-2 xl:col-span-4">
                <Button type="submit" disabled={pending}>
                    <UserPlus className="h-4 w-4" />
                    {pending ? 'Creating…' : 'Create user'}
                </Button>
                {state.error && <p className="text-sm text-red-600">{state.error}</p>}
                {state.success && <p className="text-sm text-green-600">{state.success}</p>}
            </div>
        </form>
    );
}
