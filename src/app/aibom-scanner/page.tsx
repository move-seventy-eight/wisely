'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, GitBranch, Terminal, ExternalLink, Activity, Clock, ShieldAlert, Layers, FileJson } from 'lucide-react';
import { runAibomScan, getAibomHistory, AibomResult } from '@/lib/aibom-actions';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { generateAibomReport } from '@/lib/scanner-pdf-generator';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export default function AibomScannerPage() {
    const [targetUrl, setTargetUrl] = useState('');
    const [token, setToken] = useState('');
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<AibomResult | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [historyPage, setHistoryPage] = useState(0);
    const HISTORY_PER_PAGE = 10;

    const fetchHistory = async () => {
        try {
            const h = await getAibomHistory();
            setHistory(h);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleScan = async () => {
        if (!targetUrl) return;

        setScanning(true);
        setResult(null);
        try {
            const res = await runAibomScan(targetUrl, token);
            setResult(res);
            await fetchHistory();
        } catch (error) {
            console.error(error);
        }
        setScanning(false);
    };

    const getAnalysisSource = (data: any) => {
        if (!data?.aibom_analysis?.sources) return null;
        const sources = Object.values(data.aibom_analysis.sources);
        return sources.length > 0 ? sources[0] as any : null;
    };

    const handleExportCSV = (target: string, data: any) => {
        const sourceData = getAnalysisSource(data);
        if (!sourceData || !sourceData.components) {
            toast.info('No components to export');
            return;
        }

        const headers = ['Target', 'Category', 'Component Name', 'Model Name', 'File Path', 'Line Number'];
        const csvRows = [headers.join(',')];

        Object.entries(sourceData.components).forEach(([catName, comps]: [string, any]) => {
            if (comps && comps.length > 0) {
                comps.forEach((comp: any) => {
                    csvRows.push([
                        `"${target}"`,
                        `"${catName}"`,
                        `"${comp.name || ''}"`,
                        `"${comp.model_name || ''}"`,
                        `"${comp.file_path || ''}"`,
                        `"${comp.line_number || ''}"`
                    ].join(','));
                });
            }
        });

        const csvContent = csvRows.join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `aibom_scan_${target.replace(/[^a-z0-9]/gi, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Generated CSV report');
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Layers className="h-8 w-8 text-primary" />
                        AI BOM Scanner
                    </h1>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                    Inventory AI operations (models, agents, tools) across Python source code or container images.
                    Powered by the Cisco AI Defense <code>cisco-aibom</code> library.
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Repository Scan Configuration</CardTitle>
                            <CardDescription>Enter a public GitHub or GitLab URL to dynamically clone and scan for AI Bills of Materials.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col md:flex-row items-end gap-4">
                                <div className="flex-1 space-y-2 w-full">
                                    <Label>Git Repository URL or Local Path</Label>
                                    <Input
                                        placeholder="e.g., https://github.com/organization/project"
                                        value={targetUrl}
                                        onChange={e => setTargetUrl(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                                    />
                                </div>
                                <div className="flex-1 space-y-2 w-full">
                                    <Label className="flex justify-between items-center text-muted-foreground">Git Token <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Optional</span></Label>
                                    <Input
                                        type="password"
                                        placeholder="For private repos (e.g. ghp_...)"
                                        value={token}
                                        onChange={e => setToken(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                                    />
                                </div>
                                <Button onClick={handleScan} disabled={scanning || !targetUrl} className="w-full md:w-auto gap-2">
                                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
                                    Run AIBOM Scan
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {scanning && (
                        <div className="text-center py-12 text-muted-foreground animate-pulse">
                            Generating AI Bill of Materials...
                        </div>
                    )}

                    {!scanning && result && (
                        <div className="space-y-6">
                            {!result.success && result.error && (
                                <div className="bg-red-50 text-red-900 p-4 border border-red-200 rounded-md whitespace-pre-wrap font-mono text-sm">
                                    {result.error}
                                </div>
                            )}

                            {result.success && result.data && (
                                <Card>
                                    <CardHeader className="bg-muted/30 border-b pb-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                    AI Components Inventory
                                                </CardTitle>
                                                <CardDescription>
                                                    Total Components Found: {result.data.aibom_analysis?.summary?.total_components || 0}
                                                </CardDescription>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => {
                                                        const src = getAnalysisSource(result.data);
                                                        generateAibomReport({
                                                            targetUrl,
                                                            totalComponents: result.data.aibom_analysis?.summary?.total_components || 0,
                                                            components: src?.components || {}
                                                        });
                                                    }}
                                                >
                                                    <Download className="h-4 w-4" />
                                                    PDF
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => handleExportCSV(targetUrl, result.data)}
                                                >
                                                    <Download className="h-4 w-4" />
                                                    CSV
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => {
                                                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result.data, null, 2));
                                                        const downloadAnchorNode = document.createElement('a');
                                                        downloadAnchorNode.setAttribute("href", dataStr);
                                                        downloadAnchorNode.setAttribute("download", `aibom_${targetUrl.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
                                                        document.body.appendChild(downloadAnchorNode);
                                                        downloadAnchorNode.click();
                                                        downloadAnchorNode.remove();
                                                    }}
                                                >
                                                    <FileJson className="h-4 w-4" />
                                                    JSON
                                                </Button>
                                                <Badge variant="outline" className="text-sm">
                                                    {result.data.aibom_analysis?.summary?.total_components || 0} Components
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6 space-y-6">

                                        {(() => {
                                            const sourceData = getAnalysisSource(result.data);
                                            if (!sourceData || !sourceData.components) {
                                                return (
                                                    <div className="text-center text-muted-foreground p-6 border rounded-xl bg-muted/10">
                                                        No AI framework components were detected.
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-8">
                                                    {Object.entries(sourceData.components).map(([catName, comps]: [string, any]) => {
                                                        if (!comps || comps.length === 0) return null;
                                                        return (
                                                            <div key={catName} className="space-y-3">
                                                                <h3 className="text-md font-bold capitalize border-b pb-2 flex items-center gap-2">
                                                                    <Activity className="h-4 w-4 text-blue-500" />
                                                                    {catName}s <Badge variant="secondary" className="ml-2">{comps.length}</Badge>
                                                                </h3>
                                                                <div className="grid gap-3 sm:grid-cols-2">
                                                                    {comps.map((comp: any, idx: number) => (
                                                                        <div key={idx} className="border p-3 rounded-md bg-card shadow-sm flex flex-col gap-1 text-sm">
                                                                            <span className="font-semibold break-words text-blue-600">{comp.name}</span>
                                                                            {comp.model_name && <span className="text-xs text-muted-foreground font-mono">Model: {comp.model_name}</span>}
                                                                            {comp.file_path && (
                                                                                <span className="text-xs text-muted-foreground mt-2 border-t pt-1">
                                                                                    {comp.file_path}:{comp.line_number}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}

                                        <details className="mt-4 pt-4 border-t">
                                            <summary className="text-xs text-muted-foreground cursor-pointer hover:underline">Raw JSON Export</summary>
                                            <pre className="mt-2 text-[10px] bg-muted p-4 rounded overflow-auto max-h-64 border font-mono">
                                                {JSON.stringify(result.data, null, 2)}
                                            </pre>
                                        </details>

                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="h-full flex flex-col md:max-h-[850px]">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="h-5 w-5" /> Scan History
                            </CardTitle>
                            <CardDescription>Recent AIBOM audits</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-0">
                            <ScrollArea className="h-full max-h-[700px] w-full border-t">
                                <div className="p-4 space-y-4">
                                    {history.slice(historyPage * HISTORY_PER_PAGE, (historyPage + 1) * HISTORY_PER_PAGE).map((item) => {
                                        let parsed: any = null;
                                        try { parsed = JSON.parse(item.results || '{}'); } catch (e) { }

                                        return (
                                            <div key={item.id} className="group border rounded-lg p-4 space-y-3 bg-card hover:border-primary/50 transition-colors shadow-sm">
                                                <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                                                    <div className="min-w-0 pr-2">
                                                        <p className="font-medium text-sm truncate w-full" title={item.target}>
                                                            {item.target}
                                                        </p>
                                                    </div>
                                                    <Badge variant={item.status === 'success' ? 'default' : 'destructive'} className="shrink-0 text-[10px] uppercase">
                                                        {item.status}
                                                    </Badge>
                                                </div>

                                                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                                                    <span className="flex items-center gap-1 font-mono">
                                                        <Activity className="h-3 w-3" />
                                                        {item.totalComponents} Components
                                                    </span>
                                                    <span>
                                                        {new Date(item.createdAt).toLocaleString()}
                                                    </span>
                                                </div>

                                                {item.status === 'success' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full text-xs h-8 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => {
                                                            setTargetUrl(item.target);
                                                            setResult({ success: true, data: parsed });
                                                        }}
                                                    >
                                                        View Inventory Details &rarr;
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {history.length === 0 && (
                                        <div className="text-center text-sm text-muted-foreground py-8">
                                            No AIBOM scans recorded yet.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
