'use client';

import { useActionState } from 'react';
import { changePasswordAction, PasswordActionState } from '@/app/account/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: PasswordActionState = {};

export function ChangePasswordForm() {
    const [state, action, pending] = useActionState(changePasswordAction, initialState);
    return (
        <form action={action} className="max-w-lg space-y-4">
            <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
                <p className="text-xs text-muted-foreground">12+ characters with uppercase, lowercase, number, and symbol.</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="confirmation">Confirm new password</Label>
                <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
            </div>
            {state.error && <p className="text-sm text-red-600">{state.error}</p>}
            {state.success && <p className="text-sm text-green-600">{state.success}</p>}
            <Button type="submit" disabled={pending}>{pending ? 'Updating…' : 'Update password'}</Button>
        </form>
    );
}
