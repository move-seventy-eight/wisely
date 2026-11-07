import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getWorkflowStats, getRecentActivity, getShadowAIStats, getDiscoveryStats, getN8nAdvisories, getN8nStatusAction } from '@/lib/actions';
import { Activity, ShieldAlert, Zap, Server, CheckCircle, AlertTriangle, Eye, Bell, FileCode2, Terminal, Layers, ShieldCheck } from 'lucide-react';
import { AutoSync } from '@/components/AutoSync';
import { RecentActivity } from '@/components/RecentActivity';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
    const [stats, activities, shadowAI, discovery, advisoriesData, n8nStatus] = await Promise.all([
        getWorkflowStats(),
        getRecentActivity(),
        getShadowAIStats(),
        getDiscoveryStats(),
        getN8nAdvisories(),
        getN8nStatusAction(),
    ]);
    const vulnerableEnvironments = advisoriesData.environments.filter((env: any) => env.affectedVulnerabilities.length > 0).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">Security Command Center</p>
                </div>
                <AutoSync />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Stats Cards */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.active}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.total} total workflows
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Risk Detected</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{stats.risky}</div>
                        <p className="text-xs text-muted-foreground">
                            Workflows with vulnerabilities
                        </p>
                    </CardContent>
                </Card>
                <Link href="/settings" className="block">
                    <Card className={cn(
                        "transition-colors hover:bg-muted/30 cursor-pointer h-full",
                        !n8nStatus.connected && n8nStatus.status === 'offline' && "border-red-500/30 bg-red-500/5",
                        !n8nStatus.connected && n8nStatus.status === 'auth_error' && "border-amber-500/30 bg-amber-500/5"
                    )}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">System Status</CardTitle>
                            <Activity className={cn("h-4 w-4", n8nStatus.connected ? "text-green-500" : n8nStatus.status === 'auth_error' ? "text-amber-500" : "text-red-500")} />
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-2xl font-bold", n8nStatus.connected ? "text-green-500" : n8nStatus.status === 'auth_error' ? "text-amber-500" : "text-red-500")}>
                                {n8nStatus.connected ? 'Operational' : n8nStatus.status === 'auth_error' ? 'Auth Failed' : n8nStatus.status === 'not_configured' ? 'Not Configured' : 'Offline'}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {n8nStatus.description}
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Shadow AI Stats Row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/shadow-ai">
                    <Card className="bg-gradient-to-br from-sky-400/10 to-sky-500/5 border-sky-400/20 hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Shadow AI</CardTitle>
                            <Eye className="h-4 w-4 text-sky-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{shadowAI.totalRequests}</div>
                            <p className="text-xs text-muted-foreground">
                                LLM requests monitored
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/shadow-ai">
                    <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Flagged Traffic</CardTitle>
                            <ShieldAlert className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-500">{shadowAI.flaggedRequests}</div>
                            <p className="text-xs text-muted-foreground">
                                High-risk detections
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/shadow-ai">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Detection Rules</CardTitle>
                            <Activity className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{shadowAI.activeRules}</div>
                            <p className="text-xs text-muted-foreground">
                                Active patterns
                            </p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/shadow-ai">
                    <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pending Alerts</CardTitle>
                            <Bell className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-500">{shadowAI.unresolvedAlerts}</div>
                            <p className="text-xs text-muted-foreground">
                                Need attention
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Discovery & Security Stats Row */}
            <h2 className="text-xl font-semibold tracking-tight mt-10">Threat Intelligence & Discovery</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Link href="/ai-spotter">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">AI Spotter</CardTitle>
                            <Activity className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{discovery.spotterDetections}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                AI Dependencies found across {discovery.spotters} repos
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/skill-scanner">
                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20 hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Skill Scanner</CardTitle>
                            <FileCode2 className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-500">{discovery.skillsWithFindings}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Scans with vulnerable tool logic
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/mcp-scanner">
                    <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">MCP Operations</CardTitle>
                            <Terminal className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600">{discovery.mcpFound}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Verified active MCP Servers
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/aibom-scanner">
                    <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20 hover:shadow-md transition-shadow cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">AI BOM</CardTitle>
                            <Layers className="h-4 w-4 text-indigo-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-indigo-600">{discovery.aibomComponents}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Components cataloged from {discovery.aiboms} scans
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/threat-modeler">
                    <Card className="bg-primary/5 hover:bg-primary/10 border-primary/20 hover:shadow-md transition-all cursor-pointer h-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Threat Modeler</CardTitle>
                            <ShieldCheck className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary">MAESTRO</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Full 7-Layer visual agentic analysis
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 mt-6">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest scans and detected threats</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RecentActivity activities={activities} />
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Security Posture</CardTitle>
                        <CardDescription>Overview of system health</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 py-4">
                            <CheckCircle className="h-8 w-8 text-green-500" />
                            <div className="space-y-1">
                                <p className="font-medium">Network Perimeter</p>
                                <p className="text-xs text-muted-foreground">No critical exposers on last scan</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 py-4 border-t">
                            <AlertTriangle className="h-8 w-8 text-yellow-500" />
                            <div className="space-y-1">
                                <p className="font-medium">Workflow Logic</p>
                                <p className="text-xs text-muted-foreground">{stats.risky} workflows require attention</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 py-4 border-t">
                            {vulnerableEnvironments > 0 ? (
                                <AlertTriangle className="h-8 w-8 text-red-500" />
                            ) : (
                                <Server className="h-8 w-8 text-blue-500" />
                            )}
                            <div className="space-y-1">
                                <p className="font-medium">N8n Instances</p>
                                <p className="text-xs text-muted-foreground">
                                    {vulnerableEnvironments > 0
                                        ? `${vulnerableEnvironments} instance(s) have known vulnerabilities`
                                        : 'All instance versions are secure'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
