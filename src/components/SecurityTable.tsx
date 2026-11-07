'use client'

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { Filter, Search, ChevronLeft, ChevronRight, FileDown, Loader2, ExternalLink } from 'lucide-react';
import autoTable from 'jspdf-autotable';
import { createStyledPDF, drawCoverHeader, drawPageDecoration, drawFooters } from '@/lib/pdf-assets';
import { toast } from 'sonner';

import { updateFindingStatus, getFindingStatuses } from '@/lib/actions';
import { useEffect } from 'react';

interface SecurityIssue {
    severity: string;
    type: string;
    message: string;
    nodeName: string;
    workflowId: string;
    workflowName: string;
    environmentName?: string;
    solution?: string;
    nodeId?: string;
    status?: string;
}

interface SecurityTableProps {
    issues: SecurityIssue[];
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_COLORS: Record<string, [number, number, number]> = {
    critical: [220, 38, 38],
    high: [234, 88, 12],
    medium: [202, 138, 4],
    low: [59, 130, 246]
};

function getFingerprint(issue: SecurityIssue) {
    return `${issue.workflowId || 'instance'}:${issue.nodeId || 'root'}:${issue.type}:${issue.message}`;
}

export function SecurityTable({ issues: initialIssues }: SecurityTableProps) {
    const [search, setSearch] = useState('');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'all', 'OPEN', 'FALSE_POSITIVE', 'ACCEPTED_RISK'
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isExporting, setIsExporting] = useState(false);
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const [loadingStatuses, setLoadingStatuses] = useState(true);

    const pageSize = 10;

    useEffect(() => {
        const fetchStatuses = async () => {
            try {
                const s = await getFindingStatuses();
                const statusMap: Record<string, string> = {};
                s.forEach(item => { statusMap[item.fingerprint] = item.status; });
                setStatuses(statusMap);
            } catch (error) {
                console.error('Failed to fetch finding statuses', error);
            } finally {
                setLoadingStatuses(false);
            }
        };
        fetchStatuses();
    }, []);

    const issues = useMemo(() => {
        return initialIssues.map(issue => ({
            ...issue,
            status: statuses[getFingerprint(issue)] || 'OPEN'
        }));
    }, [initialIssues, statuses]);

    const filteredIssues = useMemo(() => {
        const filtered = issues.filter(issue => {
            const matchesSearch =
                issue.workflowName.toLowerCase().includes(search.toLowerCase()) ||
                issue.nodeName.toLowerCase().includes(search.toLowerCase()) ||
                issue.message.toLowerCase().includes(search.toLowerCase()) ||
                (issue.environmentName && issue.environmentName.toLowerCase().includes(search.toLowerCase()));

            const matchesSeverity =
                severityFilter === 'all' ? true :
                    issue.severity.toLowerCase() === severityFilter.toLowerCase();

            const matchesStatus =
                statusFilter === 'all' ? true :
                    statusFilter === 'active' ? (issue.status === 'OPEN' || !issue.status) :
                        issue.status === statusFilter;

            return matchesSearch && matchesSeverity && matchesStatus;
        });
        // Always sort by severity: Critical > High > Medium > Low
        filtered.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99));
        return filtered;
    }, [issues, search, severityFilter, statusFilter]);

    const totalPages = Math.ceil(filteredIssues.length / pageSize);
    const displayedIssues = filteredIssues.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleStatusUpdate = async (issue: SecurityIssue, newStatus: string) => {
        const fingerprint = getFingerprint(issue);
        try {
            await updateFindingStatus({
                fingerprint,
                status: newStatus,
                workflowId: issue.workflowId,
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

    const allFilteredSelected = filteredIssues.length > 0 && filteredIssues.every((_, idx) => selectedIds.has(idx));

    const toggleAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(new Set());
        } else {
            const newSet = new Set<number>();
            filteredIssues.forEach((_, idx) => newSet.add(idx));
            setSelectedIds(newSet);
        }
    };

    const toggleOne = (globalIdx: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(globalIdx)) newSet.delete(globalIdx);
        else newSet.add(globalIdx);
        setSelectedIds(newSet);
    };

    const exportPDF = async (exportAll: boolean) => {
        setIsExporting(true);
        try {
            const itemsToExport = exportAll
                ? filteredIssues
                : filteredIssues.filter((_, idx) => selectedIds.has(idx));

            // Sort by severity then by type
            const sorted = [...itemsToExport].sort((a, b) => {
                const sevDiff = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
                if (sevDiff !== 0) return sevDiff;
                return a.type.localeCompare(b.type);
            });

            const doc = createStyledPDF();
            const pw = doc.internal.pageSize.getWidth();
            const margin = 18;
            const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            drawCoverHeader(
                doc,
                'Security Findings Report',
                `${dateStr}  ·  ${sorted.length} finding(s)  ·  ${exportAll ? 'All Findings' : 'Selected Findings'}`
            );

            let y = 62;

            // ══ SEVERITY SUMMARY CARDS ══
            const severityCounts = sorted.reduce((acc, i) => {
                acc[i.severity] = (acc[i.severity] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            doc.setFont('Inter', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(107, 114, 128);
            doc.text('SEVERITY BREAKDOWN', margin, y);
            y += 7;

            const sevBG: Record<string, [number, number, number]> = {
                critical: [254, 242, 242], high: [255, 247, 237],
                medium: [254, 252, 232], low: [239, 246, 255]
            };

            const cardW = (pw - margin * 2 - 12) / 4;
            const orderedSevs = ['critical', 'high', 'medium', 'low'];
            orderedSevs.forEach((sev, i) => {
                const count = severityCounts[sev] || 0;
                const color = SEVERITY_COLORS[sev] || [100, 100, 100];
                const bg = sevBG[sev] || [249, 250, 251];
                const cx = margin + i * (cardW + 4);

                doc.setFillColor(...bg);
                doc.roundedRect(cx, y, cardW, 24, 2, 2, 'F');
                doc.setFillColor(...color);
                doc.rect(cx, y, 3, 24, 'F');

                doc.setFont('Inter', 'bold');
                doc.setFontSize(18);
                doc.setTextColor(...color);
                doc.text(count.toString(), cx + cardW / 2 + 2, y + 12, { align: 'center' });

                doc.setFont('Inter', 'normal');
                doc.setFontSize(6);
                doc.setTextColor(107, 114, 128);
                doc.text(sev.toUpperCase(), cx + cardW / 2 + 2, y + 19, { align: 'center' });
            });

            y += 34;

            // ══ FINDINGS TABLE ══
            doc.setFont('Inter', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(107, 114, 128);
            doc.text('FINDINGS', margin, y);
            y += 4;

            autoTable(doc, {
                startY: y,
                head: [['#', 'Severity', 'Issue Type', 'Environment', 'Workflow', 'Node', 'Description', 'Remediation']],
                body: sorted.map((issue, idx) => [
                    (idx + 1).toString(),
                    issue.severity.toUpperCase(),
                    issue.type.replace(/_/g, ' '),
                    issue.environmentName || '—',
                    issue.workflowName,
                    issue.nodeName,
                    issue.message.length > 80 ? issue.message.substring(0, 80) + '…' : issue.message,
                    issue.solution || '—'
                ]),
                theme: 'plain',
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 6.5,
                    cellPadding: 3.5,
                },
                bodyStyles: {
                    fontSize: 6.5,
                    cellPadding: 3,
                    lineColor: [243, 244, 246],
                    lineWidth: 0.4,
                    textColor: [55, 65, 81],
                },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                columnStyles: {
                    0: { cellWidth: 7, halign: 'center' },
                    1: { cellWidth: 16, fontStyle: 'bold' },
                    2: { cellWidth: 18 },
                    3: { cellWidth: 18 },
                    4: { cellWidth: 18 },
                    5: { cellWidth: 16 },
                    6: { cellWidth: 'auto' },
                    7: { cellWidth: 26 },
                },
                didParseCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const sev = data.cell.raw?.toString().toLowerCase();
                        const color = SEVERITY_COLORS[sev];
                        if (color) data.cell.styles.textColor = color;
                    }
                },
                didDrawPage: () => drawPageDecoration(doc),
                margin: { left: margin, right: margin },
            });

            drawFooters(doc);
            doc.save(`wisely-security-report-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('PDF export error:', error);
        }
        setIsExporting(false);
    };

    const exportCSV = (exportAll: boolean) => {
        const itemsToExport = exportAll
            ? filteredIssues
            : filteredIssues.filter((_, idx) => selectedIds.has(idx));

        if (itemsToExport.length === 0) {
            toast.error('No findings to export');
            return;
        }

        const headers = ['Severity', 'Issue Type', 'Environment', 'Workflow', 'Node', 'Description', 'Remediation'];
        const csvRows = [headers.join(',')];

        itemsToExport.forEach(issue => {
            const row = [
                issue.severity.toUpperCase(),
                `"${issue.type.replace(/_/g, ' ')}"`,
                `"${issue.environmentName || ''}"`,
                `"${issue.workflowName}"`,
                `"${issue.nodeName}"`,
                `"${issue.message.replace(/"/g, '""')}"`,
                `"${(issue.solution || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `wisely-security-report-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Security findings exported as CSV');
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search findings..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={severityFilter} onValueChange={(val) => { setSeverityFilter(val); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[160px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Severity" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Severities</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[160px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active (Open)</SelectItem>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="OPEN">Open</SelectItem>
                            <SelectItem value="FALSE_POSITIVE">False Positive</SelectItem>
                            <SelectItem value="ACCEPTED_RISK">Accepted Risk</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={isExporting}
                        onClick={() => exportPDF(selectedIds.size === 0)}
                    >
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                        {selectedIds.size > 0 ? `PDF (${selectedIds.size})` : 'Export PDF'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={isExporting}
                        onClick={() => exportCSV(selectedIds.size === 0)}
                    >
                        <FileDown className="h-4 w-4" />
                        {selectedIds.size > 0 ? `CSV (${selectedIds.size})` : 'Export CSV'}
                    </Button>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox
                                    checked={allFilteredSelected}
                                    onCheckedChange={toggleAll}
                                    aria-label="Select all"
                                />
                            </TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Issue Type</TableHead>
                            <TableHead>Environment</TableHead>
                            <TableHead>Workflow</TableHead>
                            <TableHead>Node</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedIssues.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                    No findings match your criteria.
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayedIssues.map((issue, idx) => {
                                const globalIdx = (currentPage - 1) * pageSize + idx;
                                return (
                                    <TableRow key={globalIdx} className={selectedIds.has(globalIdx) ? 'bg-primary/5' : ''}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.has(globalIdx)}
                                                onCheckedChange={() => toggleOne(globalIdx)}
                                                aria-label={`Select finding ${globalIdx + 1}`}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                issue.severity === 'critical' ? 'border-red-500 text-red-500' :
                                                    issue.severity === 'high' ? 'border-orange-500 text-orange-500' :
                                                        issue.severity === 'medium' ? 'border-yellow-500 text-yellow-500' :
                                                            'border-blue-500 text-blue-500'
                                            }>
                                                {issue.severity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="capitalize">{issue.type.replace(/_/g, ' ')}</TableCell>
                                        <TableCell>
                                            {(!issue.environmentName || issue.environmentName === 'Unknown') ? (
                                                <Badge variant="outline" className="text-xs text-muted-foreground font-normal">Unknown</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs font-normal bg-muted/50 text-foreground">{issue.environmentName}</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {issue.type === 'n8n_vulnerability' ? (
                                                <Link href="/n8n-security" className="flex items-center gap-1 text-primary hover:underline transition-colors">
                                                    {issue.workflowName}
                                                    <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            ) : (
                                                <Link href={`/workflows/${issue.workflowId}`} className="flex items-center gap-1 text-primary hover:underline transition-colors">
                                                    {issue.workflowName}
                                                    <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            )}
                                        </TableCell>
                                        <TableCell>{issue.nodeName}</TableCell>
                                        <TableCell className="max-w-md truncate" title={issue.message}>
                                            {issue.message}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                issue.status === 'FALSE_POSITIVE' ? 'bg-orange-500/10 text-orange-600 border-orange-200' :
                                                    issue.status === 'ACCEPTED_RISK' ? 'bg-green-500/10 text-green-600 border-green-200' :
                                                        'bg-blue-500/10 text-blue-600 border-blue-200'
                                            }>
                                                {issue.status?.replace(/_/g, ' ') || 'OPEN'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Select
                                                    value={issue.status}
                                                    onValueChange={(val) => handleStatusUpdate(issue, val)}
                                                >
                                                    <SelectTrigger className="h-8 w-[130px] text-xs">
                                                        <SelectValue placeholder="Set Status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="OPEN">Open</SelectItem>
                                                        <SelectItem value="FALSE_POSITIVE">False Positive</SelectItem>
                                                        <SelectItem value="ACCEPTED_RISK">Accepted Risk</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Link href={issue.type === 'n8n_vulnerability' ? '/n8n-security' : `/workflows/${issue.workflowId}`}>
                                                    <Button variant="ghost" size="sm">Inspect</Button>
                                                </Link>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {totalPages > 0 && (
                <div className="flex items-center justify-end space-x-2 mt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <div className="text-sm font-medium">
                        Page {currentPage} of {totalPages}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}
