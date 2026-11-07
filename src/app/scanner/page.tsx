import { ScannerInterface } from '@/components/ScannerInterface';
import { ScanScheduler } from '@/components/ScanScheduler';
import { getScheduledScans } from '@/lib/scheduled-scan-actions';

export default async function ScannerPage() {
    const scheduledScans = await getScheduledScans();
    // Convert dates to strings or pass as is if component handles it. 
    // The component expects Date objects for lastRun/nextRun, which scan-actions returns.
    // However, server components passing to client components need serialization.
    // Let's rely on Next.js auto-serialization or map if needed.
    // Actually, Date objects are not serializable directly passed to client components in recent Next.js versions without warning/error.
    // But let's try passing them, usually it warns. 
    // To be safe, we can let component refetch or pass as initial data.

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Network Scanner</h1>
                <p className="text-muted-foreground">Detect LLM services and other open ports on your network.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-1">
                <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <ScannerInterface />
                </div>

                <div className="p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
                    <ScanScheduler initialScans={scheduledScans} />
                </div>
            </div>
        </div>
    );
}
