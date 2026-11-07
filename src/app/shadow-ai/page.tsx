import { getShadowAIStats, getDetectionRules, getLLMRequests, getThreatAlerts, seedDefaultRules } from '@/lib/actions';
import { getFlaggedRequests } from '@/lib/data-source-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, ShieldAlert, Bell, FileWarning, Activity, AlertTriangle, CheckCircle2, Settings, Zap, Radio } from 'lucide-react';
import { RuleManager } from '@/components/RuleManager';
import { AlertList } from '@/components/AlertList';
import { LiveFeed } from '@/components/LiveFeed';
import { FlaggedPrompts } from '@/components/FlaggedPrompts';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ShadowAIPage() {
    // Seed default rules on first visit
    await seedDefaultRules();

    const stats = await getShadowAIStats();
    const rules = await getDetectionRules();
    const requests = await getLLMRequests({ limit: 50 });
    const flaggedRequests = await getFlaggedRequests(50);
    const alerts = await getThreatAlerts(false); // Unacknowledged only

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Shadow AI Detection</h1>
                    <p className="text-muted-foreground">Monitor and detect unauthorized LLM usage</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 py-1.5 px-3">
                        <Eye className="h-3 w-3" />
                        Real-time Monitoring
                    </Badge>
                    <Link href="/shadow-ai/data-sources">
                        <Button variant="outline" className="gap-2">
                            <Settings className="h-4 w-4" />
                            Data Sources
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalRequests}</div>
                        <p className="text-xs text-muted-foreground">LLM API calls logged</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Flagged</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{stats.flaggedRequests}</div>
                        <p className="text-xs text-muted-foreground">High-risk detections</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Avg Risk Score</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.avgRiskScore}</div>
                        <p className="text-xs text-muted-foreground">Out of 100</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
                        <FileWarning className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeRules}</div>
                        <p className="text-xs text-muted-foreground">Detection patterns</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Alerts</CardTitle>
                        <Bell className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.unresolvedAlerts}</div>
                        <p className="text-xs text-muted-foreground">Pending review</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs - Flagwise Style */}
            <Tabs defaultValue="requests" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5 lg:w-[600px]">
                    <TabsTrigger value="requests" className="gap-1">
                        <Activity className="h-3 w-3" />
                        LLM Requests
                    </TabsTrigger>
                    <TabsTrigger value="flagged" className="gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Flagged
                    </TabsTrigger>
                    <TabsTrigger value="live" className="gap-1">
                        <Radio className="h-3 w-3" />
                        Live Feed
                    </TabsTrigger>
                    <TabsTrigger value="rules" className="gap-1">
                        <FileWarning className="h-3 w-3" />
                        Rules
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="gap-1">
                        <Bell className="h-3 w-3" />
                        Alerts
                    </TabsTrigger>
                </TabsList>

                {/* LLM Requests Tab */}
                <TabsContent value="requests">
                    <Card>
                        <CardHeader>
                            <CardTitle>LLM Request Log</CardTitle>
                            <CardDescription>All API calls to detected LLM services</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                {requests.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                                        <Eye className="h-12 w-12 mb-4 opacity-20" />
                                        <p>No LLM requests logged yet</p>
                                        <p className="text-sm">Requests will appear here when detected</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {requests.map((req: any) => (
                                            <div key={req.id} className={`flex items-center justify-between p-4 rounded-lg border ${req.isFlagged ? 'border-red-500/30 bg-red-500/5' : 'bg-card'}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${req.isFlagged ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                                                        {req.isFlagged ? <ShieldAlert className="h-5 w-5 text-red-500" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-medium">{req.provider || 'Unknown'}</p>
                                                            {req.model && <Badge variant="outline" className="text-xs">{req.model}</Badge>}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">{req.sourceIp} → {req.targetIp}:{req.targetPort}</p>
                                                        {req.promptPreview && (
                                                            <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">"{req.promptPreview}..."</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <Badge variant={req.riskScore >= 50 ? 'destructive' : 'secondary'}>
                                                            Risk: {req.riskScore}
                                                        </Badge>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(req.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Flagged Prompts Tab */}
                <TabsContent value="flagged">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-red-500" />
                                Flagged Prompts
                            </CardTitle>
                            <CardDescription>High-risk requests that triggered detection rules</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FlaggedPrompts requests={flaggedRequests as any} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Live Feed Tab */}
                <TabsContent value="live">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-yellow-500 animate-pulse" />
                                Live Feed
                            </CardTitle>
                            <CardDescription>Real-time stream of LLM requests</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <LiveFeed />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Detection Rules Tab */}
                <TabsContent value="rules">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detection Rules</CardTitle>
                            <CardDescription>Configure patterns for sensitive data detection</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <RuleManager initialRules={rules as any} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Alerts Tab */}
                <TabsContent value="alerts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Security Alerts</CardTitle>
                            <CardDescription>Flagged requests that need attention</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <AlertList initialAlerts={alerts as any} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
