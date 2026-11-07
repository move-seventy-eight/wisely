'use client';

import { useActionState, useState } from 'react';
import { Check, Copy, ShieldCheck } from 'lucide-react';
import { loginAction, setupAdminAction, AuthActionState } from '@/app/login/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: AuthActionState = {};

export function LoginForm({ setup, next, initialPassword }: { setup: boolean; next?: string; initialPassword?: string }) {
    const action = setup ? setupAdminAction : loginAction;
    const [state, formAction, pending] = useActionState(action, initialState);
    const [copied, setCopied] = useState(false);

    return (
        <form action={formAction} className="space-y-5">
            {!setup && <input type="hidden" name="next" value={next || '/'} />}

            {setup && (
                <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" name="name" autoComplete="name" required minLength={2} />
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>

            <div className="space-y-2">
                <Label htmlFor="password">{setup ? 'Generated administrator password' : 'Password'}</Label>
                {setup ? (
                    <div className="flex gap-2">
                        <Input
                            id="password"
                            name="password"
                            type="text"
                            value={initialPassword || ''}
                            readOnly
                            className="font-mono tracking-wide"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Copy password"
                            onClick={async () => {
                                await navigator.clipboard.writeText(initialPassword || '');
                                setCopied(true);
                                window.setTimeout(() => setCopied(false), 1800);
                            }}
                        >
                            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                ) : (
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        maxLength={128}
                    />
                )}
                {setup && <p className="text-xs text-muted-foreground">Copy and store this password now. It will not be shown again after setup.</p>}
            </div>

            {state.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {state.error}
                </div>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
                <ShieldCheck className="h-4 w-4" />
                {pending ? 'Processing…' : setup ? 'Create administrator account' : 'Sign in securely'}
            </Button>
        </form>
    );
}
