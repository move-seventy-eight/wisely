'use client'

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileJson, ShieldAlert, CheckCircle, ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { updateFindingStatus, getFindingStatuses } from '@/lib/actions';
import Link from 'next/link';

interface SecurityIssue {
    severity: string;
    type: string;
    message: string;
    nodeName: string;
    nodeId: string;
    index: number;
    solution?: string;
}

interface WorkflowSecurityReportProps {
    workflowId: string;
    initialIssues: SecurityIssue[];
    n8nBaseUrl?: string;
}

function getFingerprint(workflowId: string, issue: SecurityIssue) {
    return `${workflowId}:${issue.nodeId || 'root'}:${issue.type}:${issue.message}`;
}

export function WorkflowSecurityReport({ workflowId, initialIssues, n8nBaseUrl }: WorkflowSecurityReportProps) {
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'all', 'OPEN', 'FALSE_POSITIVE', 'ACCEPTED_RISK'

    useEffect(() => {
        const fetchStatuses = async () => {
            try {
                const s = await getFindingStatuses();
                const statusMap: Record<string, string> = {};
                s.forEach(item => {
                    if (item.workflowId === workflowId) {
                        statusMap[item.fingerprint] = item.status;
                    }
                });
                setStatuses(statusMap);
            } catch (error) {
                console.error('Failed to fetch finding statuses', error);
            }
        };
        fetchStatuses();
    }, [workflowId]);

    const handleStatusUpdate = async (issue: SecurityIssue, newStatus: string) => {
        const fingerprint = getFingerprint(workflowId, issue);
        try {
            await updateFindingStatus({
                fingerprint,
                status: newStatus,
                workflowId,
                nodeId: issue.nodeId,
                findingType: issue.type
            });
            setStatuses(prev => ({ ...prev, [fingerprint]: newStatus }));
            toast.success(`Finding marked as ${newStatus.replace(/_/g, ' ')}`);
        } catch (error) {
            console.error('Status update failed', error);
            toast.error('Failed to update status');
        }
    };

    const sortedIssues = [...initialIssues].sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
    });

    const filteredIssues = sortedIssues.filter(issue => {
        const status = statuses[getFingerprint(workflowId, issue)] || 'OPEN';
        if (statusFilter === 'active') return status === 'OPEN';
        if (statusFilter === 'all') return true;
        return status === statusFilter;
    });

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/20 p-3 rounded-lg border">
                <span className="text-sm font-medium text-muted-foreground">
                    Showing {filteredIssues.length} of {initialIssues.length} findings
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Filter by Status:</span>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active (Open)</SelectItem>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="OPEN">Open</SelectItem>
                            <SelectItem value="FALSE_POSITIVE">False Positive</SelectItem>
                            <SelectItem value="ACCEPTED_RISK">Accepted Risk</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-4">
                {filteredIssues.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl opacity-60">
                        <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-500" />
                        <p className="font-medium text-foreground">No matching findings</p>
                        <p className="text-sm text-muted-foreground">There are no findings that match your current filters.</p>
                    </div>
                ) : filteredIssues.map((issue, i) => {
                    const status = statuses[getFingerprint(workflowId, issue)] || 'OPEN';
                    return (
                        <div key={i} className={`flex items-start gap-4 p-5 rounded-xl border bg-card hover:bg-accent/5 transition-colors shadow-sm ${status !== 'OPEN' ? 'opacity-70 grayscale-[0.3]' : ''}`}>
                            <div className="flex-shrink-0 mt-1">
                                {issue.severity === 'critical' ? (
                                    <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center ring-1 ring-red-500/20">
                                        <ShieldAlert className="h-4 w-4 text-red-600" />
                                    </div>
                                ) : (
                                    <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-500/20">
                                        <AlertCircle className="h-4 w-4 text-orange-600" />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3 flex-1">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`font-bold tracking-tight ${issue.severity === 'critical' ? 'text-red-500' : 'text-orange-500'}`}>
                                            {issue.type.replace(/_/g, ' ').toUpperCase()}
                                        </span>
                                        <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
                                            {issue.severity}
                                        </Badge>
                                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wide font-medium ${status === 'FALSE_POSITIVE' ? 'bg-orange-500/10 text-orange-600 border-orange-200' :
                                                status === 'ACCEPTED_RISK' ? 'bg-green-500/10 text-green-600 border-green-200' :
                                                    'bg-blue-500/10 text-blue-600 border-blue-200'
                                            }`}>
                                            {status.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded border hidden sm:block">
                                            Index: <span className="text-foreground">{issue.index ?? 'N/A'}</span>
                                        </div>
                                        <Select
                                            value={status}
                                            onValueChange={(val) => handleStatusUpdate(issue, val)}
                                        >
                                            <SelectTrigger className="h-7 w-[130px] text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="OPEN">Open</SelectItem>
                                                <SelectItem value="FALSE_POSITIVE">False Positive</SelectItem>
                                                <SelectItem value="ACCEPTED_RISK">Accepted Risk</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {n8nBaseUrl && issue.nodeId && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                <Link
                                                    href={`${n8nBaseUrl.replace(/\/$/, '')}/workflow/${workflowId}/${issue.nodeId.substring(0, 6)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="Open Node in n8n"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                                    {issue.message}
                                </p>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 p-2 rounded-md border border-border/50 w-fit">
                                    <FileJson className="h-3 w-3" />
                                    <span>Node:</span>
                                    <code className="font-mono text-foreground">{issue.nodeName}</code>
                                    <span className="text-muted-foreground/50">|</span>
                                    <code className="font-mono tracking-tighter opacity-70">{issue.nodeId}</code>
                                </div>

                                {issue.solution && (
                                    <div className="mt-3 text-sm bg-green-500/5 p-4 rounded-lg border border-green-500/10 flex gap-3">
                                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="font-semibold text-green-700 text-xs uppercase tracking-wider">Remediation</p>
                                            <p className="text-muted-foreground/80 leading-relaxed">{issue.solution}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
