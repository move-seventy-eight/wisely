'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight, Database, Network, Globe, Code, MessageSquare, Cloud, HardDrive, Box, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { CiscoModelScore } from '@/components/CiscoModelScore';
import type { CiscoModelScoreMatch } from '@/lib/cisco-leaderboard';

export interface ComponentItem {
    category: string;
    service: string;
    nodeName: string;
    nodeType: string;
    workflowName: string;
    workflowId: string;
    environment: string;
    model?: string;
    modelScore?: CiscoModelScoreMatch | null;
    leaderboardAvailable?: boolean;
    workflowRiskScore: number;
    workflowActive: boolean;
}

const CategoryIcon = ({ category }: { category: string }) => {
    switch (category) {
        case 'AI / LLM': return <Network className="h-5 w-5 text-purple-500" />;
        case 'Database': return <Database className="h-5 w-5 text-blue-500" />;
        case 'Communication': return <MessageSquare className="h-5 w-5 text-indigo-500" />;
        case 'HTTP / API': return <Globe className="h-5 w-5 text-cyan-500" />;
        case 'Cloud': return <Cloud className="h-5 w-5 text-orange-500" />;
        case 'Code / Logic': return <Code className="h-5 w-5 text-yellow-500" />;
        case 'File / Storage': return <HardDrive className="h-5 w-5 text-gray-500" />;
        default: return <Box className="h-5 w-5 text-muted-foreground" />;
    }
};

export function InventoryCategoryGroup({ category, items }: { category: string; items: ComponentItem[] }) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const isAiCategory = category === 'AI / LLM';

    const filtered = items.filter(item => {
        const s = search.toLowerCase();
        return (
            item.service.toLowerCase().includes(s) ||
            item.nodeName.toLowerCase().includes(s) ||
            item.nodeType.toLowerCase().includes(s) ||
            item.workflowName.toLowerCase().includes(s) ||
            item.environment.toLowerCase().includes(s) ||
            (item.model?.toLowerCase().includes(s) ?? false)
        );
    });

    const totalPages = Math.ceil(filtered.length / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pageSize);

    // Reset pagination when searching
    const handleSearch = (value: string) => {
        setSearch(value);
        setPage(1);
    };

    return (
        <Card className="overflow-hidden">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b bg-muted/20">
                <CardTitle className="text-lg flex items-center gap-2 m-0 p-0">
                    <CategoryIcon category={category} />
                    {category}
                    <Badge variant="secondary" className="ml-2">{filtered.length} {filtered.length !== items.length && `(of ${items.length})`}</Badge>
                </CardTitle>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={`Search ${category}...`}
                        className="pl-9 h-9"
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider bg-muted/10">
                                    <th className="py-3 px-4 font-medium">Service</th>
                                    {isAiCategory && <th className="py-3 px-4 font-medium">Model</th>}
                                    {isAiCategory && <th className="py-3 px-4 font-medium">Cisco Security</th>}
                                    <th className="py-3 px-4 font-medium">Node Name</th>
                                    <th className="py-3 px-4 font-medium">Node Type</th>
                                    <th className="py-3 px-4 font-medium">Environment</th>
                                    <th className="py-3 px-4 font-medium">Workflow</th>
                                    <th className="py-3 px-4 font-medium">Workflow Posture</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y relative">
                                {paginated.length > 0 ? paginated.map((item) => (
                                    <tr key={`${item.workflowId}-${item.nodeName}-${item.nodeType}`} className="hover:bg-muted/30 transition-colors">
                                        <td className="py-3 px-4 font-medium">{item.service}</td>
                                        {isAiCategory && (
                                            <td className="py-3 px-4">
                                                {item.model ? (
                                                    <Badge variant="secondary" className="max-w-[220px] truncate bg-purple-500/10 font-mono text-[10px] text-purple-700 dark:text-purple-400">
                                                        {item.model}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Not detected</span>
                                                )}
                                            </td>
                                        )}
                                        {isAiCategory && (
                                            <td className="py-3 px-4">
                                                {item.model ? (
                                                    <CiscoModelScore
                                                        match={item.modelScore}
                                                        leaderboardAvailable={Boolean(item.leaderboardAvailable)}
                                                    />
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="py-3 px-4 truncate max-w-[200px]" title={item.nodeName}>{item.nodeName}</td>
                                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground truncate max-w-[200px]" title={item.nodeType}>{item.nodeType}</td>
                                        <td className="py-3 px-4">
                                            <Badge variant="outline" className="text-xs font-normal bg-muted/50 text-foreground">
                                                {item.environment}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4">
                                            <Link href={`/workflows/${item.workflowId}`} className="flex items-center gap-1 text-primary hover:underline transition-colors text-xs font-medium w-max">
                                                {item.workflowName}
                                                <ExternalLink className="h-3 w-3 inline-block" />
                                            </Link>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={item.workflowActive ? 'default' : 'secondary'} className={item.workflowActive ? 'bg-emerald-600 hover:bg-emerald-600' : ''}>
                                                    {item.workflowActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                                <span className={`text-xs font-semibold tabular-nums ${item.workflowRiskScore >= 40 ? 'text-red-500' : item.workflowRiskScore > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                    Risk {item.workflowRiskScore}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={isAiCategory ? 8 : 6} className="py-8 text-center text-muted-foreground">
                                            No matches found for &quot;{search}&quot;
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </ScrollArea>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
                        <span className="text-xs text-muted-foreground">
                            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filtered.length)} of {filtered.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="h-8 px-2"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs font-medium px-2">Page {page} of {totalPages}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="h-8 px-2"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
