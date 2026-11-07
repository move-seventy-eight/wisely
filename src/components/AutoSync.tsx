'use client';

import { useEffect, useState } from 'react';
import { syncWorkflows } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function AutoSync() {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const count = await syncWorkflows();
            toast.success(`Synced ${count} workflows`, {
                description: `Successfully synced ${count} workflows from n8n.`,
            });
        } catch (error) {
            toast.error("Sync Failed", {
                description: "Could not connect to n8n.",
            });
        } finally {
            setIsSyncing(false);
        }
    };

    // Auto-sync every 60 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            handleSync();
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
        >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
    );
}
