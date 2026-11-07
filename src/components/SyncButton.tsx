'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw } from 'lucide-react';
import { syncWorkflows } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function SyncButton() {
    const [isSyncing, setIsSyncing] = useState(false);
    const router = useRouter();

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const count = await syncWorkflows();
            toast.success(`Synced ${count} workflows`, {
                description: `Successfully synced ${count} workflows from n8n.`,
            });
            router.refresh();
        } catch (error) {
            toast.error("Sync Failed", {
                description: "Could not connect to n8n.",
            });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Button onClick={handleSync} disabled={isSyncing} variant="outline" size="sm">
            <RotateCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Workflows'}
        </Button>
    );
}
