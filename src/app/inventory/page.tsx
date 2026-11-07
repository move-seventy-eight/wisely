import { getUniqueAssets } from '@/lib/scan-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Box, ShieldCheck } from 'lucide-react';
import { InventoryTable } from '@/components/InventoryTable';
import { buildCiscoModelScoreMap, getCiscoLeaderboard } from '@/lib/cisco-leaderboard';

function parseModels(value: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? parsed.filter((model): model is string => typeof model === 'string') : [];
    } catch {
        return [];
    }
}

export default async function InventoryPage() {
    const [assets, leaderboard] = await Promise.all([
        getUniqueAssets(),
        getCiscoLeaderboard(),
    ]);
    const modelNames = assets.flatMap((asset) => parseModels(asset.models));
    const modelScores = buildCiscoModelScoreMap(modelNames, leaderboard);
    const uniqueModelCount = new Set(modelNames).size;
    const rankedModelCount = Object.values(modelScores).filter(Boolean).length;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">Asset Inventory</h1>
                <p className="text-muted-foreground">Comprehensive list of all detected services and assets with advanced filtering.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                        <Server className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{assets.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-none">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">LLM Services</CardTitle>
                        <Box className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {assets.filter((asset) => parseModels(asset.models).length > 0).length}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none bg-gradient-to-br from-emerald-500/10 to-transparent">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cisco Ranked Models</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{rankedModelCount}</div>
                        <p className="text-xs text-muted-foreground">of {uniqueModelCount} detected models</p>
                    </CardContent>
                </Card>
            </div>

            <InventoryTable
                assets={assets}
                modelScores={modelScores}
                leaderboardAvailable={leaderboard.length > 0}
            />
        </div>
    );
}
