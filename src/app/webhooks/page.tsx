import prisma from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WebhookTable } from '@/components/WebhookTable';

export const dynamic = 'force-dynamic';

export default async function WebhooksPage() {
    const webhooks = await prisma.webhook.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
            workflow: {
                include: { environment: { select: { id: true, name: true } } }
            }
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Endpoint Inventory</h1>
                <p className="text-muted-foreground">
                    Discover and manage all exposed N8N endpoints — Webhooks, Forms, Chat Triggers, and Wait Hooks.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Discovered Endpoints</CardTitle>
                    <CardDescription>
                        All user-input accepting nodes detected in your workflows with Test and Production URLs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <WebhookTable webhooks={webhooks as any} showTypeColumn={true} />
                </CardContent>
            </Card>
        </div>
    );
}
