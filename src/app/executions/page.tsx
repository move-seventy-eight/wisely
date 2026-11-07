import { getGlobalExecutions } from '@/lib/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { GlobalExecutionHistoryList } from '@/components/GlobalExecutionHistoryList';

export default async function GlobalExecutionsPage() {
    // Initial fetch from server to jumpstart the UI, though client will take over
    const initialExecutions = await getGlobalExecutions(50);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Executions</h1>
                <p className="text-muted-foreground">Monitor and investigate executions across all your n8n workflows.</p>
            </div>

            <GlobalExecutionHistoryList initialExecutions={initialExecutions} />
        </div>
    );
}
