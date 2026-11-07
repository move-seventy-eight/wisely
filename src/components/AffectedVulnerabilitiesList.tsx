'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Search } from 'lucide-react';
import { N8nVulnerabilityRecord } from '@/lib/osv-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const severityStyles: Record<string, string> = {
    CRITICAL: 'bg-red-500/10 text-red-600 border-red-500/20',
    HIGH: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    MEDIUM: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    LOW: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

export function AffectedVulnerabilitiesList({ vulnerabilities }: { vulnerabilities: N8nVulnerabilityRecord[] }) {
    const [query, setQuery] = useState('');
    const [severity, setSeverity] = useState('ALL');
    const [pageSize, setPageSize] = useState(5);
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return vulnerabilities.filter((vulnerability) => {
            const matchesSeverity = severity === 'ALL' || vulnerability.severity === severity;
            const matchesQuery = !normalizedQuery || [
                vulnerability.id,
                vulnerability.cve,
                vulnerability.summary,
                vulnerability.fixedIn,
            ].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedQuery));
            return matchesSeverity && matchesQuery;
        });
    }, [query, severity, vulnerabilities]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const visibleVulnerabilities = filtered.slice(startIndex, startIndex + pageSize);

    return (
        <div className="mt-2 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-red-500">Affected Vulnerabilities</p>
                    <Badge variant="destructive">{vulnerabilities.length}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{filtered.length} matching</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_90px]">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Filter by CVE, ID, summary, or fix…"
                        className="h-9 pl-9"
                    />
                </div>
                <select
                    aria-label="Filter by severity"
                    value={severity}
                    onChange={(event) => {
                        setSeverity(event.target.value);
                        setPage(1);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                    <option value="ALL">All severities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                </select>
                <select
                    aria-label="Items per page"
                    value={pageSize}
                    onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setPage(1);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                    <option value={5}>5 / page</option>
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                </select>
            </div>

            {visibleVulnerabilities.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No vulnerabilities match the selected filters.
                </div>
            ) : (
                <div className="space-y-2">
                    {visibleVulnerabilities.map((vulnerability) => (
                        <div key={vulnerability.id} className="rounded-md border bg-muted/30 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-sm font-semibold">{vulnerability.cve || vulnerability.id}</span>
                                    <Badge variant="outline" className={`text-[10px] ${severityStyles[vulnerability.severity] || severityStyles.LOW}`}>
                                        {vulnerability.severity}
                                    </Badge>
                                    {vulnerability.url && (
                                        <a href={vulnerability.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-primary" title="View reference">
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    )}
                                </div>
                                {vulnerability.fixedIn && <span className="text-xs font-medium text-green-600 dark:text-green-400">Fix: {vulnerability.fixedIn}</span>}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={vulnerability.summary}>{vulnerability.summary}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                    {filtered.length === 0
                        ? 'Showing 0 results'
                        : `Showing ${startIndex + 1}–${Math.min(startIndex + pageSize, filtered.length)} of ${filtered.length}`}
                </p>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage === 1}>
                        <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <span className="min-w-20 text-center text-xs font-medium">Page {safePage} of {totalPages}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage === totalPages}>
                        Next <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
