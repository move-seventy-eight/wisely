'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldAlert, CheckCircle2, AlertTriangle, Play, Globe, Database, Network, MessageSquare, Cloud, Code, HardDrive, Box, Settings, Plus, Trash2 } from 'lucide-react';
import { getExecutionDetails } from '@/lib/actions';
import { scanExecutionData, SecretFinding, CustomPattern } from '@/lib/secret-scanner';
import { useCustomPatterns } from '@/hooks/useCustomPatterns';

export function ExecutionViewer({ executionId, workflowId }: { executionId: string, workflowId: string }) {
    const [details, setDetails] = useState<any>(null);
    const [findings, setFindings] = useState<SecretFinding[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedNodeName, setSelectedNodeName] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'input' | 'output'>('input');

    // Store custom patterns persistently via hook
    const [customPatterns, setCustomPatterns] = useCustomPatterns();

    // Settings Dialog State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [newRegex, setNewRegex] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newSeverity, setNewSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM'>('MEDIUM');

    useEffect(() => {
        let mounted = true;
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const data = await getExecutionDetails(executionId, workflowId);
                if (mounted && data) {
                    setDetails(data);

                    // Auto-select the first node if available
                    const runData = data.data?.resultData?.runData;
                    if (runData && Object.keys(runData).length > 0) {
                        // Sort nodes by start time
                        const sortedNodes = Object.entries(runData).sort((a: any, b: any) => {
                            const timeA = a[1][0]?.startTime || 0;
                            const timeB = b[1][0]?.startTime || 0;
                            return timeA - timeB;
                        });
                        setSelectedNodeName(sortedNodes[0][0]);
                    }
                }
            } catch (error) {
                console.error("Failed to load execution details", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchDetails();
        return () => { mounted = false; };
    }, [executionId, workflowId]);

    // Rescan when details or customPatterns change
    useEffect(() => {
        if (details) {
            const detectedSecrets = scanExecutionData(details, customPatterns);
            setFindings(detectedSecrets);
        }
    }, [details, customPatterns]);

    // Derived states
    const runData = details?.data?.resultData?.runData || {};
    const hasError = details?.finished === false || details?.data?.resultData?.error;
    const overallTime = details?.stoppedAt && details?.startedAt
        ? new Date(details.stoppedAt).getTime() - new Date(details.startedAt).getTime()
        : 0;

    // Prepare sorted node list
    const nodesList = useMemo(() => {
        return Object.entries(runData).map(([name, runs]: [string, any]) => {
            const firstRun = runs[0] || {};
            const time = firstRun.executionTime || 0;
            const status = firstRun.executionStatus || 'unknown';
            const startTime = firstRun.startTime || 0;
            const hasLeaks = findings.some(f => f.nodeName === name);

            // Extract type from workflowData if possible to set icon
            let type = 'Other';
            if (details?.workflowData?.nodes) {
                const n = details.workflowData.nodes.find((nod: any) => nod.name === name);
                if (n) {
                    const t = n.type.toLowerCase();
                    if (t.includes('webhook') || t.includes('http')) type = 'HTTP / API';
                    else if (t.includes('database') || t.includes('postgres') || t.includes('mysql')) type = 'Database';
                    else if (t.includes('ai') || t.includes('llm') || t.includes('openai')) type = 'AI / LLM';
                    else type = 'Code / Logic';
                }
            }

            return { name, time, status, startTime, hasLeaks, type, runs };
        }).sort((a, b) => a.startTime - b.startTime);
    }, [runData, findings, details]);

    const getCategoryIcon = (category: string, className = "h-4 w-4") => {
        switch (category) {
            case 'AI / LLM': return <Network className={`${className} text-purple-500`} />;
            case 'Database': return <Database className={`${className} text-blue-500`} />;
            case 'HTTP / API': return <Globe className={`${className} text-cyan-500`} />;
            case 'Code / Logic': return <Code className={`${className} text-yellow-500`} />;
            default: return <Box className={`${className} text-muted-foreground`} />;
        }
    };

    const selectedNodeIndex = nodesList.findIndex(n => n.name === selectedNodeName);
    const selectedNode = (selectedNodeIndex >= 0 ? nodesList[selectedNodeIndex] : null) || nodesList[0];
    const OutputItems = selectedNode?.runs?.[0]?.data?.main?.[0] || [];

    // Robust Input computation: checks run.inputData, run.data.input, run.source, chronological predecessor, or trigger input
    const InputItems = useMemo(() => {
        if (!selectedNode || !runData) return [];
        const run = selectedNode.runs?.[0];
        if (!run) return [];

        // 1. Explicit inputData attached to the run
        if (run.inputData && Array.isArray(run.inputData) && run.inputData.length > 0) {
            return run.inputData;
        }

        // 2. Explicit data.input from n8n schema
        if (run.data?.input?.main?.[0] && Array.isArray(run.data.input.main[0]) && run.data.input.main[0].length > 0) {
            return run.data.input.main[0];
        }

        // 3. Explicit source links to previous node execution
        if (run.source && Array.isArray(run.source) && run.source.length > 0) {
            const items: any[] = [];
            run.source.forEach((src: any) => {
                if (!src.previousNode) return;
                const prevRun = runData[src.previousNode]?.[src.previousNodeRun || 0];
                if (prevRun?.data?.main?.[src.previousNodeOutput || 0]) {
                    items.push(...prevRun.data.main[src.previousNodeOutput || 0]);
                }
            });
            if (items.length > 0) return items;
        }

        // 4. Downstream node: input naturally received from previous node in chronological execution order
        if (selectedNodeIndex > 0) {
            const prevNode = nodesList[selectedNodeIndex - 1];
            const prevOutput = prevNode?.runs?.[0]?.data?.main?.[0];
            if (prevOutput && Array.isArray(prevOutput) && prevOutput.length > 0) {
                return prevOutput;
            }
        }

        // 5. Trigger/Webhook node (index 0): The incoming request payload itself represents the initial workflow input
        if (selectedNodeIndex === 0 && OutputItems.length > 0) {
            return OutputItems;
        }

        return [];
    }, [selectedNode, selectedNodeIndex, nodesList, runData, OutputItems]);

    // Inspect findings on the current node for input vs output
    const nodeFindings = useMemo(() => {
        if (!selectedNode) return [];
        return findings.filter(f => f.nodeName === selectedNode.name);
    }, [findings, selectedNode]);

    const inputFindings = useMemo(() => {
        if (InputItems.length === 0 || nodeFindings.length === 0) return [];
        const inputStr = JSON.stringify(InputItems);
        return nodeFindings.filter(f => f.location === 'input' || f.location === 'both' || inputStr.includes(f.value));
    }, [nodeFindings, InputItems]);

    const outputFindings = useMemo(() => {
        if (OutputItems.length === 0 || nodeFindings.length === 0) return [];
        const outputStr = JSON.stringify(OutputItems);
        return nodeFindings.filter(f => f.location === 'output' || f.location === 'both' || outputStr.includes(f.value));
    }, [nodeFindings, OutputItems]);

    // Intelligently default tab to Input if suspicious input is detected or if Input is available
    useEffect(() => {
        if (inputFindings.length > 0) {
            setActiveTab('input');
        } else if (outputFindings.length > 0) {
            setActiveTab('output');
        } else if (InputItems.length > 0) {
            setActiveTab('input');
        } else {
            setActiveTab('output');
        }
    }, [selectedNodeName, inputFindings.length, outputFindings.length]);

    const displayItems = activeTab === 'input' ? InputItems : OutputItems;
    const currentTabFindings = activeTab === 'input' ? inputFindings : outputFindings;

    // Extract table columns from items (using union of all keys)
    const allKeys = new Set<string>();
    displayItems.forEach((item: any) => {
        if (item?.json) {
            Object.keys(item.json).forEach(k => allKeys.add(k));
        }
    });
    const columns = Array.from(allKeys);

    if (loading) {
        return (
            <Card>
                <CardContent className="flex justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    if (!details) {
        return (
            <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                    Could not load details for execution {executionId}. It may have been deleted or is inaccessible.
                </CardContent>
            </Card>
        );
    }

    const renderHighlightedText = (text: string, activeFindings: SecretFinding[]) => {
        if (activeFindings.length === 0) return text;

        const rawText = typeof text === 'string' ? text : JSON.stringify(text);

        // Collect all secret values for this node to mask
        const secretValues = Array.from(new Set(
            activeFindings
                .map(f => f.value)
                .filter(v => v && v.length > 3)
        )).sort((a, b) => b.length - a.length); // Longest first to avoid partial matches

        if (secretValues.length === 0) return rawText;

        // Build safe regex pattern escaping all regex special characters
        const safePatterns = secretValues.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${safePatterns.join('|')})`, 'g');

        // Split text and render safe native React nodes - completely eliminates dangerouslySetInnerHTML
        const parts = rawText.split(regex);

        return (
            <span>
                {parts.map((part, idx) => {
                    if (secretValues.includes(part)) {
                        return (
                            <span key={idx} className="secret-mask" title="Hover to reveal">
                                {part}
                            </span>
                        );
                    }
                    return <span key={idx}>{part}</span>;
                })}
            </span>
        );
    };

    const renderCellValue = (value: any, isLeakNode: boolean, activeFindings: SecretFinding[]) => {
        if (value === null || value === undefined) return '';

        let content: any = '';
        if (typeof value === 'object') {
            content = (
                <div className="flex flex-col gap-1">
                    {Object.entries(value).map(([k, v]) => {
                        const strV = typeof v === 'object' ? JSON.stringify(v) : String(v);
                        return (
                            <div key={k} className="flex gap-2">
                                <span className="font-semibold text-muted-foreground">{k} : </span>
                                <span className="break-all font-medium">
                                    {isLeakNode ? renderHighlightedText(strV, activeFindings) : strV}
                                </span>
                            </div>
                        );
                    })}
                </div>
            );
        } else {
            const strVal = String(value);
            content = <span className="break-all font-medium">{isLeakNode ? renderHighlightedText(strVal, activeFindings) : strVal}</span>;
        }

        return content;
    };

    return (
        <div className="space-y-4 relative">
            {findings.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-4 w-4" /> Detected Suspicious Input & Secrets ({findings.length})
                        </h3>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {findings.map((f, i) => (
                            <div key={i} className="flex flex-col p-3 border rounded-md bg-white shadow-sm">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Badge variant="destructive" className="text-[10px] shrink-0">{f.severity}</Badge>
                                        <span className="font-semibold text-xs truncate" title={f.description}>{f.description}</span>
                                    </div>
                                    <Badge variant="outline" className={`text-[9px] shrink-0 font-mono ${f.location === 'input' ? 'border-amber-400 text-amber-700 bg-amber-50' : f.location === 'both' ? 'border-purple-400 text-purple-700 bg-purple-50' : 'border-blue-400 text-blue-700 bg-blue-50'}`}>
                                        {f.location === 'input' ? 'In Input' : f.location === 'both' ? 'Input & Output' : 'In Output'}
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground mb-2">
                                    Node: <code className="font-mono text-black">{f.nodeName}</code>
                                </p>
                                <code className="text-xs font-mono bg-red-50 p-1.5 px-2 rounded border opacity-90 blur-[6px] hover:blur-none transition-all cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis" title={f.value}>
                                    {f.value}
                                </code>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex border rounded-lg h-[600px] overflow-hidden bg-[#1c1c1c] text-neutral-200">
                {/* Left Pane: Logs Sidebar */}
                <div className="w-64 border-r border-[#333] flex flex-col bg-[#222] shrink-0">
                    <div className="p-3 border-b border-[#333] text-sm font-semibold flex items-center h-12">
                        Logs
                    </div>
                    {/* Overall execution summary */}
                    <div className="p-3 border-b border-[#333] text-xs text-neutral-400 bg-[#252525]">
                        {hasError ? 'Error' : 'Success'} in {overallTime}ms
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {nodesList.map(n => {
                            const thisNodeFindings = findings.filter(f => f.nodeName === n.name);
                            const hasInputLeak = thisNodeFindings.some(f => f.location === 'input' || f.location === 'both');
                            const hasOutputLeak = thisNodeFindings.some(f => f.location === 'output' || f.location === 'both');

                            return (
                                <button
                                    key={n.name}
                                    onClick={() => setSelectedNodeName(n.name)}
                                    className={`flex flex-col justify-center p-2 rounded-md text-sm w-full transition-colors text-left ${selectedNodeName === n.name ? 'bg-[#333] text-white shadow-sm' : 'hover:bg-[#2a2a2a] text-neutral-400'}`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {getCategoryIcon(n.type, "h-4 w-4 shrink-0")}
                                            <span className="truncate">{n.name}</span>
                                        </div>
                                        {n.hasLeaks && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                {hasInputLeak && (
                                                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-600/50" title="Suspicious Input Detected">
                                                        IN
                                                    </span>
                                                )}
                                                {hasOutputLeak && !hasInputLeak && (
                                                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-600/50" title="Suspicious Output Detected">
                                                        OUT
                                                    </span>
                                                )}
                                                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                                            </div>
                                        )}
                                    </div>
                                    {hasError && n.status === 'error' && (
                                        <div className="text-[10px] text-red-400 mt-1 pl-6">Failed</div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Pane: Main Input / Output Details */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#1c1c1c]">
                    {selectedNode ? (
                        <>
                            {/* Node Header */}
                            <div className="p-3 border-b border-[#333] flex items-center justify-between shrink-0 h-12">
                                <div className="flex items-center gap-2">
                                    {getCategoryIcon(selectedNode.type, "h-5 w-5")}
                                    <span className="font-semibold text-sm">{selectedNode.name}</span>
                                    <span className="text-xs text-neutral-500 ml-2">
                                        {selectedNode.status === 'success' ? 'Success' : 'Error'} in {selectedNode.time}ms
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {nodeFindings.length > 0 && (
                                        <Badge variant="destructive" className="bg-red-900 text-red-100 border-red-800 text-[10px] h-5 hover:bg-red-800">
                                            {nodeFindings.length} Suspicious Detection{nodeFindings.length > 1 ? 's' : ''}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Tabs Header with Suspicious Input / Output Badges */}
                            <div className="flex border-b border-[#333] bg-[#222] shrink-0 text-sm">
                                <button
                                    onClick={() => setActiveTab('input')}
                                    className={`px-4 py-2 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'input' ? 'border-[#3b82f6] text-[#3b82f6]' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
                                >
                                    Input
                                    <span className="text-[10px] bg-[#333] px-1.5 py-0.5 rounded-full">{InputItems.length}</span>
                                    {inputFindings.length > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                            <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                                            Suspicious ({inputFindings.length})
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('output')}
                                    className={`px-4 py-2 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'output' ? 'border-[#3b82f6] text-[#3b82f6]' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
                                >
                                    Output
                                    <span className="text-[10px] bg-[#333] px-1.5 py-0.5 rounded-full">{OutputItems.length}</span>
                                    {outputFindings.length > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                            <AlertTriangle className="h-2.5 w-2.5 text-rose-400" />
                                            Suspicious ({outputFindings.length})
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Data Table */}
                            <div className="flex-1 overflow-auto">
                                {displayItems.length === 0 ? (
                                    <div className="flex h-full items-center justify-center p-8 text-sm text-neutral-500 italic">
                                        No {activeTab} data available for this node.
                                    </div>
                                ) : (
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="border-b border-[#333] sticky top-0 bg-[#1c1c1c] z-10">
                                            <tr>
                                                {columns.map(col => (
                                                    <th key={col} className="px-4 py-3 font-semibold border-r border-[#333] last:border-r-0 whitespace-nowrap text-neutral-300">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayItems.map((item: any, rowIdx: number) => {
                                                const rowHasLeaks = currentTabFindings.length > 0;

                                                return (
                                                    <tr key={rowIdx} className={`border-b border-[#333] last:border-b-0 hover:bg-[#252525] transition-colors ${rowHasLeaks ? 'bg-red-950/20 hover:bg-red-950/30' : ''}`}>
                                                        {columns.map(col => {
                                                            const val = item?.json?.[col];
                                                            return (
                                                                <td key={col} className="px-4 py-3 align-top border-r border-[#333] last:border-r-0 whitespace-pre-wrap font-mono text-xs text-neutral-300">
                                                                    {renderCellValue(val, rowHasLeaks, currentTabFindings)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex h-full items-center justify-center p-12 text-neutral-500">
                            Select a node from the logs panel to securely inspect its input and output payloads.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
