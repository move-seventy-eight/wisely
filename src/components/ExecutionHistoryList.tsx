'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Play, CheckCircle2, XCircle, Clock, ShieldAlert } from 'lucide-react';
import { getWorkflowExecutions, getExecutionDetails } from '@/lib/actions';
import { ExecutionViewer } from '@/components/ExecutionViewer';
import { scanExecutionData, SecretFinding } from '@/lib/secret-scanner';
import { useCustomPatterns } from '@/hooks/useCustomPatterns';

export function ExecutionHistoryList({ workflowId }: { workflowId: string }) {
    const [executions, setExecutions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
    const [scanResults, setScanResults] = useState<Record<string, SecretFinding[]>>({});
    const [customPatterns, _, loadingPatterns] = useCustomPatterns();
    const scannedRef = useRef<Record<string, string>>({});

    const [showSuspiciousOnly, setShowSuspiciousOnly] = useState(false);

    // Clear previous scan results and ref if custom patterns change so we can re-evaluate
    useEffect(() => {
        setScanResults({});
        scannedRef.current = {};
    }, [customPatterns]);

    useEffect(() => {
        let mounted = true;
        const fetchExecutions = async () => {
            try {
                const data = await getWorkflowExecutions(workflowId, 25);
                if (mounted) {
                    setExecutions(prev => {
                        // Only update if there are new executions (avoid unnecessary re-renders)
                        if (JSON.stringify(prev.map((e: any) => e.id)) !== JSON.stringify((data || []).map((e: any) => e.id))) {
                            return data || [];
                        }
                        return prev;
                    });
                }
            } catch (error) {
                console.error("Failed to load executions", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        setLoading(true);
        fetchExecutions();

        // Auto-poll for new executions every 10 seconds
        const interval = setInterval(fetchExecutions, 10000);

        return () => { mounted = false; clearInterval(interval); };
    }, [workflowId]);

    // Asynchronously scan loaded executions for secrets
    useEffect(() => {
        if (!executions.length || loadingPatterns) return;
        let mounted = true;
        const patternsHash = JSON.stringify(customPatterns);

        const scanAll = async () => {
            for (const exec of executions) {
                if (!mounted) break;

                // Track against the exact patterns hash to avoid old closure skipping new patterns
                if (scannedRef.current[exec.id] === patternsHash) continue;

                try {
                    const details = await getExecutionDetails(exec.id, workflowId);
                    if (details && mounted) {
                        const findings = scanExecutionData(details, customPatterns);
                        setScanResults(prev => ({ ...prev, [exec.id]: findings }));
                        scannedRef.current[exec.id] = patternsHash;
                    }
                } catch (error) {
                    console.error("Failed to scan execution for secrets", exec.id);
                }
            }
        };

        scanAll();
        return () => { mounted = false; };
    }, [executions, customPatterns, loadingPatterns]);

    if (selectedExecutionId) {
        return (
            <div className="space-y-4">
                <Button variant="outline" size="sm" onClick={() => setSelectedExecutionId(null)}>
                    &larr; Back to Executions
                </Button>
                <ExecutionViewer executionId={selectedExecutionId} workflowId={workflowId} />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Play className="h-5 w-5" /> Recent Executions
                    </CardTitle>
                    <CardDescription>View the execution logs and data flow for this workflow.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <label htmlFor="suspicious-only" className="text-sm font-medium cursor-pointer">
                        Suspicious Only
                    </label>
                    <Switch
                        id="suspicious-only"
                        checked={showSuspiciousOnly}
                        onCheckedChange={setShowSuspiciousOnly}
                    />
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : executions.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        No recent executions found in n8n.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {executions
                            .filter(exec => !showSuspiciousOnly || (scanResults[exec.id] && scanResults[exec.id].length > 0))
                            .map((exec) => {
                                const findings = scanResults[exec.id];
                                const hasLeaks = findings && findings.length > 0;
                                const isScanning = findings === undefined;

                                return (
                                    <div
                                        key={exec.id}
                                        className={`flex items-center justify-between p-4 border rounded-lg transition-colors cursor-pointer group ${hasLeaks ? 'bg-red-50/30 border-red-200 hover:bg-red-50/50' : 'hover:bg-muted/50'}`}
                                        onClick={() => setSelectedExecutionId(exec.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            {exec.finished ? (
                                                exec.mode === 'error' || exec.data?.resultData?.error ? (
                                                    <XCircle className="h-5 w-5 text-red-500" />
                                                ) : (
                                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                )
                                            ) : (
                                                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                                            )}

                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm">Execution #{exec.id}</span>
                                                    <Badge variant="outline" className="text-[10px] uppercase">
                                                        {exec.mode}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(exec.startedAt).toLocaleString()}
                                                    </span>
                                                    {exec.stoppedAt && (
                                                        <span>
                                                            Duration: {((new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000).toFixed(2)}s
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {isScanning ? (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                    Scanning...
                                                </div>
                                            ) : hasLeaks ? (
                                                <Badge variant="destructive" className="flex items-center gap-1 animate-pulse mr-2">
                                                    <ShieldAlert className="h-3 w-3" />
                                                    {findings.length} suspicious input detected!
                                                </Badge>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-xs text-green-600 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Clean
                                                </div>
                                            )}
                                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                View Details &rarr;
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
