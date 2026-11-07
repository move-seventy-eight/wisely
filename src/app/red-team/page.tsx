import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Red Team - Wisely Webhooks',
    description: 'Promptfoo Evaluation Dashboard',
};

export default function RedTeamPage() {
    const promptfooUrl = process.env.NEXT_PUBLIC_PROMPTFOO_URL || 'http://localhost:15500';

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
            <div className="flex items-center justify-between p-6 pb-2">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight text-red-600">
                        Red Team Dashboard
                    </h1>
                    <p className="text-muted-foreground text-sm flex items-center gap-2">
                        Powered by <span className="font-semibold text-foreground">Promptfoo</span>
                    </p>
                </div>
            </div>

            <div className="flex-1 p-6 pt-2">
                <div className="w-full h-full rounded-xl border border-border shadow-sm overflow-hidden relative bg-card">
                    {/* Fallback state in case Promptfoo is still booting */}
                    <div className="absolute inset-0 flex items-center justify-center -z-10 bg-muted/20">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <p className="text-sm">Connecting to evaluation server ({promptfooUrl})...</p>
                        </div>
                    </div>

                    <iframe
                        src={promptfooUrl}
                        className="w-full h-full border-0 absolute inset-0 z-10"
                        title="Promptfoo Setup"
                    />
                </div>
            </div>
        </div>
    );
}
