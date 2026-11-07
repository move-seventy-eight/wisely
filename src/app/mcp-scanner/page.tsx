'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Terminal, Search, Loader2, Server, Globe, AlertTriangle, ShieldAlert, Network, ArrowRight, Clock } from 'lucide-react';
import { runMcpScan, sweepNetworkForMcp, McpScanResult, SweepResult, getMcpHistory } from '@/lib/mcp-actions';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScheduleSection } from '@/components/ScheduleSection';
import { generateMcpScannerReport, generateMcpSweepReport } from '@/lib/scanner-pdf-generator';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export default function McpScannerPage() {
    const [target, setTarget] = useState('');
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState<McpScanResult[]>([]);

    const [subnet, setSubnet] = useState('');
    const [sweeping, setSweeping] = useState(false);
    const [sweepResults, setSweepResults] = useState<SweepResult[]>([]);

    // Switch to direct scan tab and run
    const [activeTab, setActiveTab] = useState('direct');
    const [history, setHistory] = useState<any[]>([]);
    const [historyPage, setHistoryPage] = useState(0);
    const HISTORY_PER_PAGE = 10;

    const fetchHistory = async () => {
        try {
            const h = await getMcpHistory();
            setHistory(h);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleScan = async (urlToScan?: string) => {
        const finalTarget = typeof urlToScan === 'string' ? urlToScan : target;
        if (!finalTarget) return;

        // Auto move to target tab if running from sweep
        if (typeof urlToScan === 'string') {
            setTarget(finalTarget);
            setActiveTab('direct');
        }

        setScanning(true);
        try {
            const scanResult = await runMcpScan(finalTarget);
            setResults(prev => [scanResult, ...prev]);
            await fetchHistory();
        } catch (error) {
            console.error(error);
        }
        setScanning(false);
    };

    const handleSweep = async () => {
        if (!subnet) return;
        setSweeping(true);
        setSweepResults([]);
        try {
            const sweepData = await sweepNetworkForMcp(subnet);
            setSweepResults(sweepData);
        } catch (error) {
            console.error("Sweep failed:", error);
        }
        setSweeping(false);
    };

    const handleExportSweepCSV = () => {
        if (!sweepResults || sweepResults.length === 0) return;
        const headers = ['URL', 'Protocol Version', 'Capabilities'];
        const csvRows = [headers.join(',')];
        sweepResults.forEach((r: any) => {
            const caps = r.details?.capabilities ? r.details.capabilities.join('; ') : '';
            csvRows.push(`"${r.url}","${r.details?.protocolVersion || ''}","${caps}"`);
        });
        const csvContent = csvRows.join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'mcp_sweep_report.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Sweep CSV generated and downloaded');
    };

    const handleExportScanCSV = (res: any) => {
        let servers: Record<string, any> = {};
        if (res.details?.servers) {
            servers = res.details.servers;
        } else if (res.details) {
            Object.values(res.details).forEach((val: any) => {
                if (val && Array.isArray(val.servers)) {
                    val.servers.forEach((s: any) => { if (s.name) servers[s.name] = s; });
                }
            });
        }

        const headers = ['URL', 'Server Name', 'Severity', 'Vulnerability', 'Description'];
        const csvRows = [headers.join(',')];

        if (Object.keys(servers).length === 0) {
            csvRows.push(`"${res.url}","No Servers Found","","",""`);
        } else {
            Object.entries(servers).forEach(([serverName, serverData]: [string, any]) => {
                const vulns = serverData.vulnerabilities || [];
                if (vulns.length === 0) {
                    csvRows.push(`"${res.url}","${serverName}","Secure","No Vulnerabilities",""`);
                } else {
                    vulns.forEach((v: any) => {
                        csvRows.push(`"${res.url}","${serverName}","High","${(v.type || v.name || 'Vuln').replace(/"/g, '""')}","${(v.description || '').replace(/"/g, '""')}"`);
                    });
                }
            });
        }

        const csvContent = csvRows.join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `mcp_scan_${res.url ? res.url.replace(/[^a-z0-9]/gi, '_') : 'report'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Scan CSV generated and downloaded');
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Terminal className="h-8 w-8 text-primary" />
                        MCP Scanner
                    </h1>
                </div>
                <p className="text-muted-foreground">
                    Discover and audit Model Context Protocol (MCP) servers in your network.
                    Checks for SSE endpoints and MCP-specific headers.
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2 space-y-8">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="direct">Direct Scanner</TabsTrigger>
                            <TabsTrigger value="sweep">Network Sweep</TabsTrigger>
                        </TabsList>

                        <TabsContent value="direct">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Direct Remote Scan</CardTitle>
                                    <CardDescription>Enter the IP / URL of the Model Context Protocol endpoint to remotely scan its security profile.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-col md:flex-row items-end gap-4">
                                        <div className="flex-1 space-y-2 w-full">
                                            <Label>Remote Target (URL / IP)</Label>
                                            <Input
                                                placeholder="e.g., http://192.168.1.50/mcp or https://api.example.com/sse"
                                                value={target}
                                                onChange={e => setTarget(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                                            />
                                        </div>
                                        <Button onClick={() => handleScan()} disabled={scanning || !target} className="w-full md:w-auto">
                                            {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                            Scan Target
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="sweep">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Network Subnet Sweeper</CardTitle>
                                    <CardDescription>Rapidly probe a CIDR block (/24 max) or a comma-separated IP list to auto-discover active MCP endpoints.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-col md:flex-row items-end gap-4">
                                        <div className="flex-1 space-y-2 w-full">
                                            <Label>Target Range (CIDR or IPs)</Label>
                                            <Input
                                                placeholder="e.g., 10.0.0.0/24 or 192.168.1.50, 192.168.1.55"
                                                value={subnet}
                                                onChange={e => setSubnet(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSweep()}
                                            />
                                        </div>
                                        <Button onClick={handleSweep} disabled={sweeping || !subnet} className="w-full md:w-auto gap-2">
                                            {sweeping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
                                            Sweep Network
                                        </Button>
                                    </div>

                                    {/* Sweep Results Display */}
                                    {sweepResults.length > 0 && (
                                        <div className="mt-6 border rounded-md">
                                            <div className="bg-muted p-2 rounded-t-md border-b flex justify-between items-center">
                                                <h3 className="text-sm font-semibold">Discovered Endpoints ({sweepResults.length})</h3>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1 h-7"
                                                        onClick={() => generateMcpSweepReport(subnet, sweepResults)}
                                                    >
                                                        <Download className="h-3 w-3" />
                                                        PDF
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1 h-7"
                                                        onClick={handleExportSweepCSV}
                                                    >
                                                        <Download className="h-3 w-3" />
                                                        CSV
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="divide-y max-h-[300px] overflow-auto">
                                                {sweepResults.map((r, i) => (
                                                    <div key={i} className="flex justify-between items-center p-3 hover:bg-muted/30 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <Server className="h-4 w-4 text-emerald-500" />
                                                            <div>
                                                                <p className="font-mono text-sm font-medium">{r.url}</p>
                                                                <p className="text-xs text-muted-foreground flex gap-2">
                                                                    {r.details?.protocolVersion && <span>Version: {r.details.protocolVersion}</span>}
                                                                    {r.details?.capabilities && <span>Caps: {r.details.capabilities.join(', ')}</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Button size="sm" variant="outline" onClick={() => handleScan(r.url)} className="gap-2">
                                                            Analyze <ArrowRight className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {sweeping && (
                                        <div className="text-center py-6 text-muted-foreground animate-pulse">
                                            Probing network ports (3000, 5000, 8080) for MCP signatures...
                                        </div>
                                    )}

                                    {!sweeping && sweepResults.length === 0 && subnet && (
                                        <div className="text-center py-6 text-sm text-muted-foreground">
                                            No active MCP endpoints detected in this range.
                                        </div>
                                    )}

                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    <div className="grid gap-6 md:grid-cols-1">
                        {results.map((res, idx) => {
                            const hasDetails = !!res.details;
                            let servers: Record<string, any> = {};
                            if (res.details?.servers) {
                                servers = res.details.servers;
                            } else if (res.details) {
                                // Fallback for old nested structure
                                Object.values(res.details).forEach((val: any) => {
                                    if (val && Array.isArray(val.servers)) {
                                        val.servers.forEach((s: any) => { if (s.name) servers[s.name] = s; });
                                    }
                                });
                            }
                            const isError = !res.isMcp || res.error;

                            return (
                                <Card key={idx} className={hasDetails ? "border-primary/20" : "border-red-200"}>
                                    <CardHeader className="pb-3 border-b bg-muted/30">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Server className="h-5 w-5 text-primary" />
                                                <CardTitle className="text-lg">
                                                    Scan Results {res.url ? `for ${res.url}` : '(Auto Discovery)'}
                                                </CardTitle>
                                            </div>
                                            {isError ? (
                                                <Badge variant="destructive">Error</Badge>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1 h-7"
                                                        onClick={() => generateMcpScannerReport({
                                                            target: res.url || target,
                                                            isMcp: res.isMcp ?? false,
                                                            details: res.details,
                                                            error: res.error,
                                                        })}
                                                    >
                                                        <Download className="h-3 w-3" />
                                                        PDF
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1 h-7"
                                                        onClick={() => handleExportScanCSV(res)}
                                                    >
                                                        <Download className="h-3 w-3" />
                                                        CSV
                                                    </Button>
                                                    <Badge className="bg-green-600">Completed</Badge>
                                                </div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4 space-y-6">
                                        {isError && (
                                            <div className="text-red-500 font-mono text-xs bg-red-50/50 p-4 rounded border border-red-100">
                                                {res.error || "Failed to scan."}
                                            </div>
                                        )}

                                        {Object.keys(servers).length === 0 && !isError && (
                                            <div className="text-muted-foreground text-sm">
                                                No MCP servers or vulnerabilities found.
                                            </div>
                                        )}

                                        {Object.entries(servers).map(([serverName, serverData]: [string, any]) => {
                                            const vulns = serverData.vulnerabilities || [];
                                            const isVulnerable = vulns.length > 0;

                                            return (
                                                <div key={serverName} className="border rounded-md p-4 space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="font-semibold flex items-center gap-2">
                                                                <Terminal className="h-4 w-4 text-muted-foreground" />
                                                                {serverName}
                                                            </h3>
                                                            {serverData.signature?.metadata?.serverInfo && (
                                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                                    {serverData.signature.metadata.serverInfo.name} v{serverData.signature.metadata.serverInfo.version}
                                                                    {serverData.signature.metadata.protocolVersion && `  ·  Protocol: ${serverData.signature.metadata.protocolVersion}`}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2">
                                                            {isVulnerable ? (
                                                                <Badge variant="destructive" className="flex items-center gap-1">
                                                                    <ShieldAlert className="h-3 w-3" />
                                                                    {vulns.length} Vulnerabilities
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="border-green-500 text-green-600">Secure</Badge>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {serverData.signature?.metadata?.capabilities && (
                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                            {Object.keys(serverData.signature.metadata.capabilities).map(cap => (
                                                                <Badge key={cap} variant="secondary" className="px-1 py-0 h-4 text-[9px] bg-blue-50 text-blue-700 border-blue-100 uppercase">
                                                                    {cap}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {isVulnerable && (
                                                        <div className="space-y-3 mt-4">
                                                            {vulns.map((v: any, vIdx: number) => (
                                                                <div key={vIdx} className="bg-red-50/50 border border-red-100 rounded p-3 text-sm">
                                                                    <div className="font-medium text-red-800 flex items-center gap-2 mb-1">
                                                                        <AlertTriangle className="h-4 w-4" />
                                                                        {v.type || v.name || "Vulnerability"}
                                                                    </div>
                                                                    <p className="text-red-700/80 mb-2">{v.description || "No description provided."}</p>
                                                                    {v.details && (
                                                                        <pre className="mt-2 text-xs bg-red-100/50 p-2 rounded overflow-x-auto text-red-900">
                                                                            {JSON.stringify(v.details, null, 2)}
                                                                        </pre>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                                        {/* Tools Column */}
                                                        {serverData.signature?.tools?.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tools</p>
                                                                    <Badge variant="outline" className="h-4 text-[9px] px-1">{serverData.signature.tools.length}</Badge>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {serverData.signature.tools.map((t: any) => (
                                                                        <div key={t.name} className="p-2 bg-muted/40 rounded border border-muted-foreground/10">
                                                                            <p className="text-[10px] font-mono font-bold leading-tight">{t.name}</p>
                                                                            {t.description && <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Prompts Column */}
                                                        {serverData.signature?.prompts?.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Prompts</p>
                                                                    <Badge variant="outline" className="h-4 text-[9px] px-1">{serverData.signature.prompts.length}</Badge>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {serverData.signature.prompts.map((p: any) => (
                                                                        <div key={p.name} className="p-2 bg-blue-50/30 rounded border border-blue-100/50">
                                                                            <p className="text-[10px] font-mono font-bold leading-tight text-blue-900">{p.name}</p>
                                                                            {p.description && <p className="text-[9px] text-blue-800/60 mt-0.5 line-clamp-1">{p.description}</p>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Resources Column */}
                                                        {serverData.signature?.resources?.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Resources</p>
                                                                    <Badge variant="outline" className="h-4 text-[9px] px-1">{serverData.signature.resources.length}</Badge>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {serverData.signature.resources.map((r: any) => (
                                                                        <div key={r.uri || r.name} className="p-2 bg-green-50/30 rounded border border-green-100/50">
                                                                            <p className="text-[10px] font-mono font-bold leading-tight text-green-900">{r.name || r.uri}</p>
                                                                            {r.description && <p className="text-[9px] text-green-800/60 mt-0.5 line-clamp-1">{r.description}</p>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {res.rawOutput && (
                                            <details className="mt-4">
                                                <summary className="text-xs text-muted-foreground cursor-pointer hover:underline">View Raw Output</summary>
                                                <pre className="mt-2 text-[10px] bg-muted p-4 rounded overflow-auto max-h-64 border">
                                                    {res.rawOutput}
                                                </pre>
                                            </details>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {results.length === 0 && !scanning && (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                            <Globe className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No scans performed yet.</p>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="h-full flex flex-col md:max-h-[850px]">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="h-5 w-5" /> Scan History
                            </CardTitle>
                            <CardDescription>Recent MCP endpoint checks</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-0">
                            <ScrollArea className="h-full max-h-[700px] w-full border-t">
                                <div className="p-4 space-y-4">
                                    {history.slice(historyPage * HISTORY_PER_PAGE, (historyPage + 1) * HISTORY_PER_PAGE).map((item) => {
                                        let parsed: any = null;
                                        try { parsed = item.results ? JSON.parse(item.results) : null; } catch (e) { }

                                        let servers: Record<string, any> = {};
                                        if (parsed?.servers) {
                                            servers = parsed.servers;
                                        } else if (parsed) {
                                            // Handle old nested structure
                                            Object.values(parsed).forEach((val: any) => {
                                                if (val && Array.isArray(val.servers)) {
                                                    val.servers.forEach((s: any) => { if (s.name) servers[s.name] = s; });
                                                }
                                            });
                                        }

                                        const serverCount = Object.keys(servers).length;
                                        const hasVulns = Object.values(servers).some((s: any) => s.vulnerabilities?.length > 0);
                                        const actuallyMcp = serverCount > 0;

                                        return (
                                            <details key={item.id} className="group border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                                                <summary className="p-3 cursor-pointer list-none">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-medium text-sm truncate max-w-[150px]" title={item.target}>
                                                            {item.target}
                                                        </span>
                                                        <Badge
                                                            variant={item.status === 'success' && actuallyMcp ? (hasVulns ? 'destructive' : 'default') : 'secondary'}
                                                            className={item.status === 'success' && actuallyMcp && !hasVulns ? 'bg-green-600' : ''}
                                                        >
                                                            {item.status === 'success'
                                                                ? (actuallyMcp ? (hasVulns ? 'Vulnerable' : 'MCP Found') : 'No MCP')
                                                                : 'Error'}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {new Date(item.createdAt).toLocaleString()}
                                                    </div>
                                                    {item.status === 'success' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full text-xs h-8 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setTarget(item.target);
                                                                setActiveTab('direct');
                                                                setResults([{
                                                                    isMcp: actuallyMcp,
                                                                    url: item.target,
                                                                    rawOutput: JSON.stringify(parsed, null, 2),
                                                                    details: parsed
                                                                }]);
                                                            }}
                                                        >
                                                            View Full Report &rarr;
                                                        </Button>
                                                    )}
                                                </summary>
                                                <div className="px-3 pb-3 pt-1 border-t space-y-2">
                                                    {item.error && (
                                                        <p className="text-xs text-red-500 font-mono">{item.error}</p>
                                                    )}
                                                    {serverCount > 0 ? Object.entries(servers).map(([name, data]: [string, any]) => (
                                                        <div key={name} className="text-xs space-y-1">
                                                            <p className="font-semibold">{name}</p>
                                                            {data.vulnerabilities?.length > 0 ? (
                                                                <ul className="list-disc pl-4 text-red-600">
                                                                    {data.vulnerabilities.map((v: any, i: number) => (
                                                                        <li key={i}>{v.type || v.name || 'Vulnerability'}</li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <p className="text-green-600">No vulnerabilities found</p>
                                                            )}
                                                            {data.tools?.length > 0 && (
                                                                <p className="text-muted-foreground">Tools: {data.tools.map((t: any) => t.name).join(', ')}</p>
                                                            )}
                                                        </div>
                                                    )) : (
                                                        <p className="text-xs text-muted-foreground">No MCP servers detected at this endpoint.</p>
                                                    )}
                                                </div>
                                            </details>
                                        );
                                    })}
                                    {history.length === 0 && (
                                        <div className="text-center text-sm text-muted-foreground py-8">
                                            No scans recorded yet.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                            {history.length > HISTORY_PER_PAGE && (
                                <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
                                    <button onClick={() => setHistoryPage(p => Math.max(0, p - 1))} disabled={historyPage === 0} className="text-primary disabled:text-muted-foreground disabled:cursor-not-allowed">← Prev</button>
                                    <span className="text-muted-foreground">{historyPage + 1} / {Math.ceil(history.length / HISTORY_PER_PAGE)}</span>
                                    <button onClick={() => setHistoryPage(p => Math.min(Math.ceil(history.length / HISTORY_PER_PAGE) - 1, p + 1))} disabled={historyPage >= Math.ceil(history.length / HISTORY_PER_PAGE) - 1} className="text-primary disabled:text-muted-foreground disabled:cursor-not-allowed">Next →</button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="pt-4 border-t">
                <ScheduleSection scanType="mcp_scanner" targetPlaceholder="http://localhost:3000 or subnet" />
            </div>
        </div>
    );
}
