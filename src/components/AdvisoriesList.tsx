'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { N8nVulnerabilityRecord } from '@/lib/osv-api';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { forceRefreshAdvisories } from '@/lib/actions';

interface AdvisoriesListProps {
    advisories: N8nVulnerabilityRecord[];
}

export function AdvisoriesList({ advisories }: AdvisoriesListProps) {
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();
    const pageSize = 10;

    const [isPending, startTransition] = useTransition();

    const filteredAdvisories = advisories.filter(adv => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            adv.id.toLowerCase().includes(q) ||
            (adv.cve && adv.cve.toLowerCase().includes(q)) ||
            adv.summary.toLowerCase().includes(q) ||
            adv.severity.toLowerCase().includes(q)
        );
    });

    // Auto-refresh every 5 minutes (300000 ms)
    useEffect(() => {
        const interval = setInterval(() => {
            startTransition(async () => {
                await forceRefreshAdvisories();
            });
        }, 300000);
        return () => clearInterval(interval);
    }, []);

    const totalPages = Math.ceil(filteredAdvisories.length / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedAdvisories = filteredAdvisories.slice(startIndex, startIndex + pageSize);

    if (advisories.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
                <p>No advisories found for n8n in the OSV database.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <div className="relative w-full">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search advisories by CVE, ID or summary..."
                            className="pl-9 h-9"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1); // Reset page on search
                            }}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground hidden sm:block">
                        Displaying data from OSV & GitHub
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            startTransition(async () => {
                                await forceRefreshAdvisories();
                            });
                        }}
                        disabled={isPending}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-4">
                {paginatedAdvisories.map((adv) => (
                    <Card key={adv.id} className="overflow-hidden">
                        <div className="flex flex-col md:flex-row">
                            <div className={`w-1.5 flex-shrink-0 ${adv.severity === 'CRITICAL' ? 'bg-red-500' :
                                adv.severity === 'HIGH' ? 'bg-orange-500' :
                                    adv.severity === 'MEDIUM' ? 'bg-yellow-500' :
                                        'bg-blue-500'
                                }`} />
                            <div className="flex-1 p-5">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg">{adv.cve || adv.id}</h3>
                                            {adv.cve && <Badge variant="secondary" className="font-mono text-xs">{adv.id}</Badge>}
                                        </div>
                                        <p className="text-sm font-medium">{adv.summary}</p>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                            <span>Published: {new Date(adv.published).toLocaleDateString()}</span>
                                            <span>Vulnerable ranges: <code className="bg-muted px-1 py-0.5 rounded">{adv.affectedVersions}</code></span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:items-end gap-2">
                                        <Badge variant="outline" className={`uppercase ${adv.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                                            adv.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' :
                                                adv.severity === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                                                    'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                            }`}>
                                            {adv.severity}
                                        </Badge>
                                        {adv.url && (
                                            <a href={adv.url} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-primary hover:underline">
                                                Reference <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                                {adv.details && (
                                    <div className="mt-4 pt-4 border-t text-sm text-muted-foreground prose dark:prose-invert max-w-none prose-sm overflow-hidden line-clamp-3 hover:line-clamp-none transition-all">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {adv.details}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {totalPages > 0 && (
                <div className="flex items-center justify-between mt-6">
                    <p className="text-sm text-muted-foreground">
                        Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredAdvisories.length)} of {filteredAdvisories.length} advisories
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </Button>
                        <span className="text-sm font-medium">Page {page} of {totalPages}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
