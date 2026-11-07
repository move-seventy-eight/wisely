import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Clover, Radar, ShieldAlert, Workflow } from 'lucide-react';
import prisma from '@/lib/db';
import { generateStrongPassword, getCurrentUser } from '@/lib/auth';
import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
    title: 'Sign in | Wisely',
    description: 'Secure sign-in for Wisely',
};

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string }>;
}) {
    if (await getCurrentUser()) redirect('/');

    const setup = (await prisma.user.count()) === 0;
    const { next } = await searchParams;
    const initialPassword = setup ? generateStrongPassword() : undefined;

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_38%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.12),transparent_32%)]" />
            <div className="relative grid w-full max-w-5xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <section className="hidden space-y-8 lg:block">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                            <Clover className="h-7 w-7" />
                        </div>
                        <span className="text-3xl font-bold tracking-tight">Wisely</span>
                    </div>
                    <div className="space-y-4">
                        <h1 className="max-w-xl text-5xl font-bold leading-tight tracking-tight">
                            Secure every layer of AI and automation.
                        </h1>
                        <p className="max-w-lg text-lg text-muted-foreground">
                            Audit n8n workflows, discover AI services, model threats, and continuously test your attack surface from one command center.
                        </p>
                    </div>
                    <div className="grid max-w-xl grid-cols-3 gap-4">
                        {[
                            [Workflow, 'Workflow Security'],
                            [Radar, 'AI Discovery'],
                            [ShieldAlert, 'Threat Modeling & Red Teaming'],
                        ].map(([Icon, label]) => {
                            const FeatureIcon = Icon as typeof Workflow;
                            return (
                                <div key={String(label)} className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
                                    <FeatureIcon className="mb-3 h-5 w-5 text-primary" />
                                    <p className="text-sm font-medium">{String(label)}</p>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <Card className="border-primary/10 shadow-2xl shadow-primary/10">
                    <CardHeader className="space-y-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary lg:hidden">
                            <Clover className="h-6 w-6" />
                        </div>
                        <CardTitle>{setup ? 'Initial administrator setup' : 'Welcome back'}</CardTitle>
                        <CardDescription>
                            {setup
                                ? 'Wisely generated a strong one-time password for the first administrator.'
                                : 'Sign in to continue to your Wisely workspace.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <LoginForm setup={setup} next={next} initialPassword={initialPassword} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
