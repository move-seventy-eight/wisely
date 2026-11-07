'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Play, CheckCircle2, XCircle, Clock, ShieldAlert, ArrowLeft, ExternalLink, Activity } from 'lucide-react';
import { getGlobalExecutions, getExecutionDetails } from '@/lib/actions';
import { ExecutionViewer } from '@/components/ExecutionViewer';
import { scanExecutionData, SecretFinding } from '@/lib/secret-scanner';
import { useCustomPatterns } from '@/hooks/useCustomPatterns';
import Link from 'next/link';
import { Input } from '@/components/ui/input';

export function GlobalExecutionHistoryList({ initialExecutions }: { initialExecutions: any[] }) {
    const [executions, setExecutions] = useState<any[]>(initialExecutions);
    const [loading, setLoading] = useState(false);
    const [selectedExecution, setSelectedExecution] = useState<{ id: string, workflowId: string } | null>(null);
    const [scanResults, setScanResults] = useState<Record<string, SecretFinding[]>>({});
    const [customPatterns, _, loadingPatterns] = useCustomPatterns();
    const scannedRef = useRef<Record<string, string>>({});

    const [showSuspiciousOnly, setShowSuspiciousOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [displayLimit, setDisplayLimit] = useState(50);
    const [hasMore, setHasMore] = useState(true);

    // Clear previous scan results and ref if custom patterns change so we can re-evaluate
    useEffect(() => {
        setScanResults({});
        scannedRef.current = {};
    }, [customPatterns]);

    useEffect(() => {
        let mounted = true;
        const fetchExecutions = async (isManual = false) => {
            if (isManual) setLoading(true);
            try {
                const data = await getGlobalExecutions(displayLimit);
                if (mounted) {
                    setExecutions(prev => {
                        // Compare the data to see if we actually need an update
                        const prevIds = JSON.stringify(prev.map((e: any) => e.id));
                        const nextIds = JSON.stringify((data || []).map((e: any) => e.id));

                        if (prevIds !== nextIds) {
                            return data || [];
                        }
                        return prev;
                    });

                    // If we got fewer items than requested, we reached the end
                    if (data && data.length < displayLimit) {
                        setHasMore(false);
                    } else {
                        // Only set hasMore to true if we actually have items
                        setHasMore(data && data.length > 0);
                    }
                }
            } catch (error) {
                console.error("Failed to load global executions", error);
            } finally {
                if (mounted && isManual) setLoading(false);
            }
        };

        // Initial fetch (manual-like to show initial loader)
        fetchExecutions(executions.length === 0);

        // Auto-poll for new executions every 15 seconds
        const interval = setInterval(() => fetchExecutions(false), 15000);

        return () => { mounted = false; clearInterval(interval); };
    }, [displayLimit]);

    const handleLoadMore = () => {
        setDisplayLimit(prev => prev + 50);
    };

    // Asynchronously scan loaded executions for secrets
    useEffect(() => {
        if (!executions.length || loadingPatterns) return;
        let mounted = true;
        const patternsHash = JSON.stringify(customPatterns);

        const scanAll = async () => {
            for (const exec of executions) {
                if (!mounted) break;
                if (!exec.workflowId) continue;

                if (scannedRef.current[exec.id] === patternsHash) continue;

                try {
                    const details = await getExecutionDetails(exec.id, exec.workflowId);
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

    if (selectedExecution) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={() => setSelectedExecution(null)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Executions
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/workflows/${selectedExecution.workflowId}`}>
                            View Workflow <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
                <ExecutionViewer executionId={selectedExecution.id} workflowId={selectedExecution.workflowId} />
            </div>
        );
    }

    const filteredExecutions = executions.filter(exec => {
        if (showSuspiciousOnly && (!scanResults[exec.id] || scanResults[exec.id].length === 0)) {
            return false;
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                exec.id.toString().includes(query) ||
                (exec.workflowName && exec.workflowName.toLowerCase().includes(query)) ||
                (exec.environmentName && exec.environmentName.toLowerCase().includes(query))
            );
        }

        return true;
    });

    return (
        <Card>
            <CardHeader className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" /> All Executions
                    </CardTitle>
                    <CardDescription>Latest {executions.length} executions across all monitored workflows.</CardDescription>
                </div>
                <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
                    <Input
                        placeholder="Search ID, Workflow..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full sm:w-64 h-9"
                    />
                    <div className="flex items-center gap-2 bg-muted/30 p-2 border rounded-md">
                        <label htmlFor="suspicious-only" className="text-sm font-medium cursor-pointer whitespace-nowrap">
                            Suspicious Only
                        </label>
                        <Switch
                            id="suspicious-only"
                            checked={showSuspiciousOnly}
                            onCheckedChange={setShowSuspiciousOnly}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading && executions.length === 0 ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredExecutions.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
                        {showSuspiciousOnly ? "No suspicious executions found." : "No recent executions found in n8n."}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredExecutions.map((exec) => {
                            const findings = scanResults[exec.id];
                            const hasLeaks = findings && findings.length > 0;
                            const isScanning = findings === undefined;

                            return (
                                <div
                                    key={exec.id}
                                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg transition-colors cursor-pointer group gap-4 sm:gap-0 ${hasLeaks ? 'bg-red-50/20 border-red-500/30 hover:bg-red-50/40' : 'hover:bg-muted/50'}`}
                                    onClick={() => setSelectedExecution({ id: exec.id, workflowId: exec.workflowId })}
                                >
                                    <div className="flex items-start sm:items-center gap-4">
                                        <div className="mt-1 sm:mt-0">
                                            {exec.finished ? (
                                                exec.mode === 'error' || exec.data?.resultData?.error ? (
                                                    <XCircle className="h-5 w-5 text-red-500" />
                                                ) : (
                                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                )
                                            ) : (
                                                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-bold text-sm">#{exec.id}</span>
                                                <span className="text-muted-foreground text-xs">•</span>
                                                <span className="font-semibold text-sm text-primary max-w-[200px] sm:max-w-xs truncate" title={exec.workflowName}>{exec.workflowName || 'Unknown Workflow'}</span>
                                                <Badge variant="outline" className="text-[10px] uppercase ml-1">
                                                    {exec.mode}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(exec.startedAt).toLocaleString()}
                                                </span>
                                                {exec.stoppedAt && (
                                                    <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                                        {((new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000).toFixed(2)}s
                                                    </span>
                                                )}
                                                <Badge variant="secondary" className="font-normal text-[10px] h-4 leading-4 py-0">
                                                    {exec.environmentName}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end sm:justify-center gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0">
                                        {isScanning ? (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Scanning
                                            </div>
                                        ) : hasLeaks ? (
                                            <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
                                                <ShieldAlert className="h-3 w-3" />
                                                {findings.length} suspicious inputs
                                            </Badge>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Clean
                                            </div>
                                        )}
                                        <Button variant="secondary" size="sm" className="h-8 text-xs font-medium px-3">
                                            View Details
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {filteredExecutions.length > 0 && hasMore && !searchQuery && !showSuspiciousOnly && (
                    <div className="mt-6 flex justify-center">
                        <Button
                            variant="outline"
                            onClick={handleLoadMore}
                            disabled={loading}
                            className="w-full sm:w-auto min-w-[200px] border-primary/20 hover:bg-primary/5 text-primary"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                "Load More Executions (50+)"
                            )}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
