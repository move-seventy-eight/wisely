'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { diffLines } from 'diff';
import React, { useMemo } from 'react';
import { cn } from "@/lib/utils";
import { analyzeWorkflow } from "@/lib/security";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface DiffViewerProps {
    isOpen: boolean;
    onClose: () => void;
    oldData: any;
    newData: any;
    version: number;
}

const severityColorMap: Record<string, { bg: string; border: string; text: string; label: string }> = {
    critical: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-300', label: 'Critical' },
    high: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-300', label: 'High' },
    medium: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-300', label: 'Medium' },
    low: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-300', label: 'Low' },
};

export function DiffViewer({ isOpen, onClose, oldData, newData, version }: DiffViewerProps) {
    const oldJson = JSON.stringify(oldData, null, 2);
    const newJson = JSON.stringify(newData, null, 2);

    const diff = useMemo(() => diffLines(oldJson, newJson), [oldJson, newJson]);

    // Analyze the NEW data to find current vulnerabilities
    const issues = useMemo(() => {
        return analyzeWorkflow({ nodes: newData } as any);
    }, [newData]);

    // Build a map: nodeName → { worstSeverity, issueTypes[] }
    const nodeVulnMap = useMemo(() => {
        const map: Record<string, { severity: string; types: string[] }> = {};
        issues.forEach((issue: any) => {
            const name = issue.nodeName;
            if (!map[name]) {
                map[name] = { severity: issue.severity, types: [] };
            }
            map[name].types.push(issue.type.replace(/_/g, ' '));
            // Promote severity
            const order = ['critical', 'high', 'medium', 'low'];
            if (order.indexOf(issue.severity) < order.indexOf(map[name].severity)) {
                map[name].severity = issue.severity;
            }
        });
        return map;
    }, [issues]);

    const downloadJson = (data: any, versionLabel: string) => {
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = `workflow-v${versionLabel}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center pr-8">
                        <span>Version {version} Changes</span>
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span>Comparison with the previous version.</span>
                            {issues.length > 0 && (
                                <>
                                    <span className="text-muted-foreground">|</span>
                                    <span className="font-semibold">{issues.length} vulnerability(s) detected</span>
                                    {Object.entries(
                                        issues.reduce((acc: Record<string, number>, i: any) => {
                                            acc[i.severity] = (acc[i.severity] || 0) + 1;
                                            return acc;
                                        }, {})
                                    ).map(([sev, count]) => {
                                        const colors = severityColorMap[sev] || severityColorMap.low;
                                        return (
                                            <Badge key={sev} variant="outline" className={`${colors.text} border-current text-[10px]`}>
                                                {count} {colors.label}
                                            </Badge>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    </DialogDescription>
                </DialogHeader>

                {/* Vulnerability legend */}
                {issues.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-[10px] px-1">
                        {Object.entries(nodeVulnMap).map(([nodeName, info]) => {
                            const colors = severityColorMap[info.severity] || severityColorMap.low;
                            return (
                                <div key={nodeName} className={`flex items-center gap-1 px-2 py-0.5 rounded border ${colors.border} ${colors.bg}`}>
                                    <span className={`font-bold ${colors.text}`}>{nodeName}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-slate-300">{info.types.join(', ')}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex flex-col h-full overflow-hidden border rounded-md">
                    <div className="grid grid-cols-2 bg-muted p-2 text-sm font-medium border-b">
                        <div className="flex justify-between items-center text-red-500 px-2">
                            <span>Previous Version</span>
                            <Button variant="ghost" size="sm" className="h-6 text-red-500" onClick={() => downloadJson(oldData, `${version - 1}`)}>
                                <Download className="h-3 w-3 mr-1" /> JSON
                            </Button>
                        </div>
                        <div className="flex justify-between items-center text-green-500 px-2">
                            <span>Current (v{version})</span>
                            <Button variant="ghost" size="sm" className="h-6 text-green-500" onClick={() => downloadJson(newData, `${version}`)}>
                                <Download className="h-3 w-3 mr-1" /> JSON
                            </Button>
                        </div>
                    </div>
                    <ScrollArea className="h-[55vh] p-4 bg-slate-950 text-slate-50 font-mono text-xs overflow-auto">
                        {diff.map((part, index) => {
                            let color = part.added ? 'bg-green-900/30 text-green-400' : part.removed ? 'bg-red-900/30 text-red-400' : 'text-slate-400 opacity-50';
                            const matchedNodes: { name: string; severity: string; types: string[] }[] = [];

                            // Check if this diff part mentions ANY vulnerable nodes — collect all
                            if (part.added || !part.removed) {
                                for (const [name, info] of Object.entries(nodeVulnMap)) {
                                    if (part.value.includes(`"${name}"`) || part.value.includes(`'${name}'`)) {
                                        matchedNodes.push({ name, severity: info.severity, types: info.types });
                                    }
                                }
                            }

                            // Use the worst severity for the background color
                            if (matchedNodes.length > 0) {
                                const severityOrder = ['critical', 'high', 'medium', 'low'];
                                const worstSev = matchedNodes.reduce((worst, n) => {
                                    return severityOrder.indexOf(n.severity) < severityOrder.indexOf(worst) ? n.severity : worst;
                                }, 'low');
                                const sc = severityColorMap[worstSev] || severityColorMap.low;
                                color = `${sc.bg} ${sc.text} border-l-2 ${sc.border} font-bold`;
                            }

                            return (
                                <div key={index} className={cn("whitespace-pre-wrap break-all px-1 relative group", color)}>
                                    {matchedNodes.length > 0 && (
                                        <div className="absolute right-2 top-0 flex flex-col items-end gap-0.5">
                                            {matchedNodes.map((node, ni) => {
                                                const nodeColors = severityColorMap[node.severity] || severityColorMap.low;
                                                return (
                                                    <span key={ni} className={`text-[9px] px-1 rounded-b ${nodeColors.bg} ${nodeColors.text} border ${nodeColors.border}`}>
                                                        ⚠ {node.name}: {node.types.join(' | ')}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {part.value}
                                </div>
                            );
                        })}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
