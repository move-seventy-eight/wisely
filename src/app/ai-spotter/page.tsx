'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, GitBranch, Terminal, ExternalLink, Activity, Clock, ShieldAlert } from 'lucide-react';
import { runAiSpotter, AiSpotterResult } from '@/lib/spotter-actions';
import { getSpotterHistory } from '@/lib/spotter-actions';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ScheduleSection } from '@/components/ScheduleSection';
import { generateAiSpotterReport } from '@/lib/scanner-pdf-generator';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export default function AiSpotterPage() {
    const [targetUrl, setTargetUrl] = useState('');
    const [token, setToken] = useState('');
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState<AiSpotterResult | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [historyPage, setHistoryPage] = useState(0);
    const HISTORY_PER_PAGE = 10;

    const fetchHistory = async () => {
        try {
            const h = await getSpotterHistory();
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
            const res = await runAiSpotter(targetUrl, token);
            setResult(res);
            await fetchHistory();
        } catch (error) {
            console.error(error);
        }
        setScanning(false);
    };

    const handleExportCSV = (target: string, findings: any[]) => {
        if (!findings || findings.length === 0) {
            toast.info('No findings to export as CSV');
            return;
        }

        const headers = ['Repository', 'Service Name', 'Severity', 'Detection Type', 'File Path', 'Line Number', 'Evidence'];
        const csvRows = [headers.join(',')];

        findings.forEach((f: any) => {
            csvRows.push([
                `"${target}"`,
                `"${f.service_name || f.name || ''}"`,
                `"${f.severity || ''}"`,
                `"${f.detection_type || f.type || ''}"`,
                `"${f.file_path || ''}"`,
                `"${f.line_number || ''}"`,
                `"${(f.evidence || '').replace(/"/g, '""')}"`
            ].join(','));
        });

        const csvContent = csvRows.join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `ai_spotter_${target.split('/').pop() || 'report'}.csv`);
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
                        <Activity className="h-8 w-8 text-primary" />
                        AI-Spotter Dashboard
                    </h1>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                    Identify AI service dependencies, LLM SDK usage, and potential API key configurations leaked inside a remote Git repository.
                    Powered by the open-source <code>ai-spotter</code> detection engine.
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Repository Scan Configuration</CardTitle>
                            <CardDescription>Enter a public GitHub or GitLab URL to dynamically clone and scan for AI usage.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col md:flex-row items-end gap-4">
                                <div className="flex-1 space-y-2 w-full">
                                    <Label>Git Repository URL</Label>
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
                                    Run Spotter
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {scanning && (
                        <div className="text-center py-12 text-muted-foreground animate-pulse">
                            Cloning repository and analyzing AST & dependencies...
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
                                                    Scan Results
                                                </CardTitle>
                                                <CardDescription>
                                                    Analyzed at {result.data.scan_timestamp}
                                                </CardDescription>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => {
                                                        const findings = result.data?.findings || result.data?.results || result.data?.detections || [];
                                                        generateAiSpotterReport({
                                                            repoUrl: targetUrl,
                                                            totalDetections: result.data?.total_detections || 0,
                                                            servicesFound: result.data?.services_found || [],
                                                            findings,
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
                                                    onClick={() => {
                                                        const findings = result.data?.findings || result.data?.results || result.data?.detections || [];
                                                        handleExportCSV(targetUrl, findings);
                                                    }}
                                                >
                                                    <Download className="h-4 w-4" />
                                                    CSV
                                                </Button>
                                                <Badge variant="outline" className="text-sm">
                                                    {result.data.total_detections} Detections
                                                </Badge>
                                                <Badge variant="secondary" className="text-sm">
                                                    {result.data.services_found?.length || 0} Services Found
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-6 space-y-6">

                                        {result.data.services_found && result.data.services_found.length > 0 ? (
                                            <div className="mb-6 p-4 border rounded-xl bg-muted/20">
                                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                                    <ShieldAlert className="h-4 w-4 text-primary" />
                                                    Detected API Integrations
                                                </h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {result.data.services_found.map((srv: string) => (
                                                        <Badge key={srv} variant="default" className="text-sm py-1 px-3 bg-blue-600 hover:bg-blue-700 capitalize">
                                                            {srv}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center text-muted-foreground p-6 border rounded-xl bg-muted/10">
                                                No known AI services or LLM footprints were detected in this repository.
                                            </div>
                                        )}

                                        {Object.entries(result.data.summary || {}).map(([key, value]: [string, any]) => (
                                            <div key={key} className="mb-4">
                                                <h3 className="text-sm font-semibold capitalize mb-2">{key.replace('_', ' ')}</h3>
                                                <div className="flex gap-4">
                                                    {Object.entries(value).map(([subK, subV]: [string, any]) => (
                                                        <Badge key={subK} variant="outline" className="capitalize">
                                                            {subK}: {subV}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        {/* As ai-spotter CLI JSON contains "results" array of actual detections: */}
                                        {result.data.results && result.data.results.length > 0 && (
                                            <div className="mt-8">
                                                <h3 className="text-md font-semibold mb-4 border-b pb-2">Detailed Findings</h3>
                                                <div className="space-y-4">
                                                    {result.data.results.map((finding: any, idx: number) => {
                                                        const sevColor = finding.severity === 'warning' ? 'bg-orange-500' : 'bg-blue-500';
                                                        return (
                                                            <div key={idx} className="border rounded-md overflow-hidden bg-card">
                                                                <div className="flex justify-between items-start p-3 bg-muted/40 border-b">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge className={sevColor}>{finding.severity}</Badge>
                                                                        <span className="font-bold text-sm">{finding.service_name}</span>
                                                                        <Badge variant="secondary">{finding.detection_type}</Badge>
                                                                    </div>
                                                                </div>
                                                                <div className="p-3">
                                                                    <p className="text-sm text-foreground/80 mb-2">{finding.evidence}</p>
                                                                    <div className="text-xs font-mono bg-muted/20 border-t p-2 mt-2 break-all">
                                                                        File: {finding.file_path} {finding.line_number ? `(Line: ${finding.line_number})` : ''}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <details className="mt-4 pt-4 border-t">
                                            <summary className="text-xs text-muted-foreground cursor-pointer hover:underline">Raw JSON Response</summary>
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
                            <CardDescription>Recent AI repository audits</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-0">
                            <ScrollArea className="h-full max-h-[700px] w-full border-t">
                                <div className="p-4 space-y-4">
                                    {history.slice(historyPage * HISTORY_PER_PAGE, (historyPage + 1) * HISTORY_PER_PAGE).map((item) => {
                                        let services: string[] = [];
                                        try { services = JSON.parse(item.servicesFound || '[]'); } catch (e) { }
                                        let parsed: any = null;
                                        try { parsed = item.results ? JSON.parse(item.results) : null; } catch (e) { }
                                        const detailedFindings = parsed?.results || parsed?.detections || parsed?.findings || [];

                                        return (
                                            <details key={item.id} className="group border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                                                <summary className="p-3 cursor-pointer list-none">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-medium text-sm truncate max-w-[150px]" title={item.repoUrl}>
                                                            {item.repoUrl.split('/').pop()}
                                                        </span>
                                                        <Badge variant={item.status === 'success' && item.totalDetections > 0 ? 'default' : 'secondary'} className={item.status === 'success' && item.totalDetections > 0 ? 'bg-orange-500' : ''}>
                                                            {item.status === 'success' ? `${item.totalDetections} hits` : 'Error'}
                                                        </Badge>
                                                        {item.status === 'success' && (
                                                            <div className="flex gap-1 ml-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6"
                                                                    title="Export PDF"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        let parsed: any = null;
                                                                        try { parsed = item.results ? JSON.parse(item.results) : null; } catch (e) { }
                                                                        const findings = parsed?.findings || parsed?.results || parsed?.detections || [];
                                                                        const services = JSON.parse(item.servicesFound || '[]');
                                                                        generateAiSpotterReport({
                                                                            repoUrl: item.repoUrl,
                                                                            totalDetections: item.totalDetections,
                                                                            servicesFound: services,
                                                                            findings,
                                                                        });
                                                                    }}
                                                                >
                                                                    <Download className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                    title="Export CSV"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        let parsed: any = null;
                                                                        try { parsed = item.results ? JSON.parse(item.results) : null; } catch (e) { }
                                                                        const findings = parsed?.findings || parsed?.results || parsed?.detections || [];
                                                                        handleExportCSV(item.repoUrl, findings);
                                                                    }}
                                                                >
                                                                    <Download className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mb-1">
                                                        {new Date(item.createdAt).toLocaleString()}
                                                    </div>
                                                    {services.length > 0 && (
                                                        <div className="flex gap-1 flex-wrap">
                                                            {services.slice(0, 3).map((s: string) => (
                                                                <Badge key={s} variant="outline" className="text-[10px] px-1 py-0 h-4 capitalize">{s}</Badge>
                                                            ))}
                                                            {services.length > 3 && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">+{services.length - 3}</Badge>}
                                                        </div>
                                                    )}
                                                    {item.status === 'success' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full text-xs h-8 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setTargetUrl(item.repoUrl);
                                                                setResult({ success: true, data: parsed });
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
                                                    {detailedFindings.length > 0 ? detailedFindings.map((f: any, i: number) => (
                                                        <div key={i} className="text-xs border-l-2 border-orange-400 pl-2 space-y-0.5">
                                                            <p className="font-semibold">{f.service_name || f.name || 'Detection'} <span className="text-muted-foreground">({f.detection_type || f.type || 'match'})</span></p>
                                                            {f.file_path && (
                                                                <p className="text-muted-foreground font-mono">
                                                                    📄 {f.file_path}{f.line_number && <span className="text-orange-600">:L{f.line_number}</span>}
                                                                </p>
                                                            )}
                                                            {f.evidence && <p className="text-muted-foreground truncate" title={f.evidence}>{f.evidence}</p>}
                                                        </div>
                                                    )) : services.length > 0 ? (
                                                        <div className="text-xs space-y-1">
                                                            <p className="font-semibold text-muted-foreground">Detected Services:</p>
                                                            <div className="flex gap-1 flex-wrap">
                                                                {services.map((s: string) => (
                                                                    <span key={s} className="px-1.5 py-0.5 bg-orange-500/10 text-orange-600 rounded text-[10px] capitalize">{s}</span>
                                                                ))}
                                                            </div>
                                                            <p className="text-muted-foreground mt-1">{item.totalDetections} total detection(s)</p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground">{item.status === 'success' ? 'No AI service detections recorded.' : 'Scan did not complete successfully.'}</p>
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
                <ScheduleSection scanType="ai_spotter" targetPlaceholder="https://github.com/user/repo" />
            </div>
        </div>
    );
}
