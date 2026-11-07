'use client'

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ExternalLink, Search, ChevronLeft, ChevronRight, Filter, FileCode2, MoreHorizontal, TerminalSquare, Copy, Download, Code, CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { CopyButton } from '@/components/CopyButton';
import { generateWebhookPayloads } from '@/lib/webhook-payload';

interface Webhook {
    id: string;
    active: boolean;
    method: string;
    nodeName: string;
    prodUrl: string;
    testUrl: string;
    updatedAt: Date | string;
    workflowId: string;
    type?: string;
    workflow: {
        name: string;
        environment?: { name: string };
        nodes?: string;
        connections?: string;
    };
}

interface WebhookTableProps {
    webhooks: Webhook[];
    showTypeColumn?: boolean;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    webhook: { label: 'Webhook', color: 'bg-blue-500 hover:bg-blue-600' },
    form: { label: 'Form', color: 'bg-purple-500 hover:bg-purple-600' },
    chat: { label: 'Chat', color: 'bg-emerald-500 hover:bg-emerald-600' },
    wait: { label: 'Wait Hook', color: 'bg-amber-500 hover:bg-amber-600' },
};

export function WebhookTable({ webhooks, showTypeColumn = false }: WebhookTableProps) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [httpDialogOpenFor, setHttpDialogOpenFor] = useState<string | null>(null);
    const [pfDialogOpenFor, setPfDialogOpenFor] = useState<string | null>(null);
    const pageSize = 10;

    // Get unique types present in the data for the filter dropdown
    const availableTypes = useMemo(() => {
        const types = new Set(webhooks.map(wh => wh.type || 'webhook'));
        return Array.from(types).sort();
    }, [webhooks]);

    const filteredWebhooks = useMemo(() => {
        return webhooks.filter(wh => {
            const matchesSearch =
                wh.nodeName.toLowerCase().includes(search.toLowerCase()) ||
                wh.workflow.name.toLowerCase().includes(search.toLowerCase()) ||
                wh.prodUrl.toLowerCase().includes(search.toLowerCase());

            const matchesStatus =
                statusFilter === 'all' ? true :
                    statusFilter === 'active' ? wh.active :
                        !wh.active;

            const matchesType =
                typeFilter === 'all' ? true :
                    (wh.type || 'webhook') === typeFilter;

            return matchesSearch && matchesStatus && matchesType;
        });
    }, [webhooks, search, statusFilter, typeFilter]);

    const totalPages = Math.ceil(filteredWebhooks.length / pageSize);
    const displayedWebhooks = filteredWebhooks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handleDownloadPromptmap = (wh: Webhook) => {
        const payload = generateWebhookPayloads(wh);
        const blob = new Blob([payload.promptmapYaml], { type: 'text/yaml' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `promptmap-${wh.id}.yaml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    };

    const handleDownloadPyRIT = (wh: Webhook) => {
        const payload = generateWebhookPayloads(wh);
        const blob = new Blob([payload.pyritScript], { type: 'text/x-python' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `pyrit-${wh.id}.py`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    };

    const selectedHttpWebhook = useMemo(() => webhooks.find(w => w.id === httpDialogOpenFor), [webhooks, httpDialogOpenFor]);
    const selectedHttpPayload = useMemo(() => selectedHttpWebhook ? generateWebhookPayloads(selectedHttpWebhook) : null, [selectedHttpWebhook]);

    const selectedPfWebhook = useMemo(() => webhooks.find(w => w.id === pfDialogOpenFor), [webhooks, pfDialogOpenFor]);
    const selectedPfPayload = useMemo(() => selectedPfWebhook ? generateWebhookPayloads(selectedPfWebhook) : null, [selectedPfWebhook]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search endpoints..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="flex gap-2">
                    {showTypeColumn && availableTypes.length > 1 && (
                        <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setCurrentPage(1); }}>
                            <SelectTrigger className="w-[180px]">
                                <Filter className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {availableTypes.map(t => (
                                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]?.label || t}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[180px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            {showTypeColumn && <TableHead>Type</TableHead>}
                            <TableHead>Method</TableHead>
                            <TableHead>Node Name</TableHead>
                            <TableHead>Environment</TableHead>
                            <TableHead>Workflow</TableHead>
                            <TableHead>Production URL</TableHead>
                            <TableHead>Test URL</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedWebhooks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={showTypeColumn ? 9 : 8} className="h-24 text-center text-muted-foreground">
                                    No endpoints found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayedWebhooks.map((wh) => {
                                const typeInfo = TYPE_LABELS[wh.type || 'webhook'] || TYPE_LABELS.webhook;
                                return (
                                    <TableRow key={wh.id}>
                                        <TableCell>
                                            <Badge variant={wh.active ? 'default' : 'secondary'} className={wh.active ? 'bg-green-500 hover:bg-green-600' : ''}>
                                                {wh.active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        {showTypeColumn && (
                                            <TableCell>
                                                <Badge variant="default" className={typeInfo.color}>
                                                    {typeInfo.label}
                                                </Badge>
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono">
                                                {wh.method}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">{wh.nodeName}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-xs font-normal bg-muted/50 text-foreground">
                                                {wh.workflow.environment?.name || 'Unknown'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/workflows/${encodeURIComponent(wh.workflowId.trim())}`} className="flex items-center gap-1 text-primary hover:underline transition-colors font-medium">
                                                {wh.workflow.name}
                                                <ExternalLink className="h-3 w-3 shrink-0" />
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 max-w-[250px]">
                                                {wh.prodUrl ? (
                                                    <a
                                                        href={wh.prodUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="bg-muted hover:bg-muted/80 px-2 py-1 rounded text-xs truncate flex-1 block font-mono text-primary hover:underline transition-colors"
                                                        title={`Open ${wh.prodUrl}`}
                                                    >
                                                        {wh.prodUrl}
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                                {wh.prodUrl && <CopyButton value={wh.prodUrl} />}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 max-w-[250px]">
                                                {wh.testUrl ? (
                                                    <a
                                                        href={wh.testUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="bg-muted hover:bg-muted/80 px-2 py-1 rounded text-xs truncate flex-1 block font-mono text-primary hover:underline transition-colors"
                                                        title={`Open ${wh.testUrl}`}
                                                    >
                                                        {wh.testUrl}
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                                {wh.testUrl && <CopyButton value={wh.testUrl} />}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/workflows/${encodeURIComponent(wh.workflowId.trim())}`} className="cursor-pointer">
                                                            <ExternalLink className="mr-2 h-4 w-4" />
                                                            View Workflow
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {wh.prodUrl && (
                                                        <DropdownMenuItem asChild>
                                                            <a href={wh.prodUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                                Open Production URL
                                                            </a>
                                                        </DropdownMenuItem>
                                                    )}
                                                    {wh.testUrl && (
                                                        <DropdownMenuItem asChild>
                                                            <a href={wh.testUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                                Open Test URL
                                                            </a>
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    {(wh.type === 'webhook' || wh.type === 'wait' || !wh.type) ? (
                                                        <>
                                                            <DropdownMenuItem onClick={() => setHttpDialogOpenFor(wh.id)}>
                                                                <TerminalSquare className="mr-2 h-4 w-4" />
                                                                View Raw HTTP
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => setPfDialogOpenFor(wh.id)}>
                                                                <FileCode2 className="mr-2 h-4 w-4" />
                                                                View Promptfoo Config
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleDownloadPromptmap(wh)}>
                                                                <Download className="mr-2 h-4 w-4" />
                                                                Download Promptmap Config
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleDownloadPyRIT(wh)}>
                                                                <Download className="mr-2 h-4 w-4" />
                                                                Download PyRIT Config
                                                            </DropdownMenuItem>
                                                        </>
                                                    ) : null}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* HTTP Dialog Content */}
            <Dialog open={!!selectedHttpWebhook} onOpenChange={(open) => !open && setHttpDialogOpenFor(null)}>
                {selectedHttpWebhook && selectedHttpPayload && (
                    <DialogContent className="max-w-2xl sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <TerminalSquare className="h-5 w-5 text-primary" />
                                <span>Raw HTTP Request Payload</span>
                            </DialogTitle>
                            <DialogDescription>
                                Generated dynamically from the actual parameters expected by <strong>{selectedHttpWebhook.nodeName}</strong> in <em>{selectedHttpWebhook.workflow.name}</em>.
                            </DialogDescription>
                        </DialogHeader>

                        {/* Parameter Detection Summary */}
                        <div className="rounded-lg border p-3 bg-muted/40 text-xs space-y-2 mt-2">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-foreground flex items-center gap-1.5">
                                    {selectedHttpPayload.params.hasExplicitParams ? (
                                        <>
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                            <span>Parameters extracted from workflow:</span>
                                        </>
                                    ) : (
                                        <>
                                            <Info className="h-3.5 w-3.5 text-amber-500" />
                                            <span>Parameter detection notice:</span>
                                        </>
                                    )}
                                </span>
                                <Badge variant="outline" className="text-[10px] font-mono">
                                    {selectedHttpPayload.method}
                                </Badge>
                            </div>
                            {selectedHttpPayload.params.hasExplicitParams ? (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {selectedHttpPayload.params.sourceDetails.map((detail, idx) => (
                                        <Badge key={idx} variant="secondary" className="font-mono text-[11px] gap-1 px-2 py-0.5">
                                            <span className="font-semibold text-primary">{detail.name}</span>
                                            <span className="text-muted-foreground text-[10px]">
                                                ({detail.type}{detail.nodeName && detail.nodeName !== selectedHttpWebhook.nodeName ? ` via ${detail.nodeName}` : ''})
                                            </span>
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">
                                    No specific body keys are explicitly referenced downstream. The workflow accepts a generic payload or passes data as a whole.
                                </p>
                            )}
                        </div>

                        {/* View Formats Tabs */}
                        <Tabs defaultValue="raw" className="w-full mt-2">
                            <TabsList className="grid grid-cols-3 w-full">
                                <TabsTrigger value="raw">Raw HTTP (RFC 9112)</TabsTrigger>
                                <TabsTrigger value="curl">cURL Command</TabsTrigger>
                                <TabsTrigger value="json">JSON Body Only</TabsTrigger>
                            </TabsList>

                            <TabsContent value="raw" className="relative mt-2">
                                <pre className="bg-muted border rounded-md p-4 overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all max-h-72">
                                    {selectedHttpPayload.rawHttpRequest}
                                </pre>
                                <div className="absolute top-2 right-2 flex items-center gap-2">
                                    <CopyButton value={selectedHttpPayload.rawHttpRequest} />
                                </div>
                            </TabsContent>

                            <TabsContent value="curl" className="relative mt-2">
                                <pre className="bg-muted border rounded-md p-4 overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all max-h-72">
                                    {selectedHttpPayload.curlCommand}
                                </pre>
                                <div className="absolute top-2 right-2 flex items-center gap-2">
                                    <CopyButton value={selectedHttpPayload.curlCommand} />
                                </div>
                            </TabsContent>

                            <TabsContent value="json" className="relative mt-2">
                                <pre className="bg-muted border rounded-md p-4 overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all max-h-72">
                                    {selectedHttpPayload.rawJsonBody}
                                </pre>
                                <div className="absolute top-2 right-2 flex items-center gap-2">
                                    <CopyButton value={selectedHttpPayload.rawJsonBody} />
                                </div>
                            </TabsContent>
                        </Tabs>

                        <DialogFooter className="sm:justify-between items-center mt-2 gap-2">
                            <span className="text-xs text-muted-foreground truncate max-w-sm">
                                URL: <code className="text-foreground">{selectedHttpPayload.url}</code>
                            </span>
                            <Button type="button" variant="default" onClick={() => {
                                navigator.clipboard.writeText(selectedHttpPayload.rawHttpRequest);
                            }} className="gap-2">
                                <Copy className="h-4 w-4" />
                                Copy Raw HTTP
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>

            {/* Promptfoo Config Dialog */}
            <Dialog open={!!selectedPfWebhook} onOpenChange={(open) => !open && setPfDialogOpenFor(null)}>
                {selectedPfWebhook && selectedPfPayload && (
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <FileCode2 className="h-5 w-5 text-primary" />
                                <span>Promptfoo HTTP Provider</span>
                            </DialogTitle>
                            <DialogDescription>
                                Configured with the actual parameters expected by <strong>{selectedPfWebhook.nodeName}</strong>. You can use this snippet directly in your <code>promptfooconfig.yaml</code> under the <code>providers</code> list.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="relative mt-4">
                            <pre className="bg-muted border rounded-md p-4 overflow-x-auto text-xs font-mono whitespace-pre-wrap break-all max-h-80">
                                {selectedPfPayload.promptfooSnippet}
                            </pre>
                            <div className="absolute top-2 right-2 flex items-center gap-2">
                                <CopyButton value={selectedPfPayload.promptfooSnippet} />
                            </div>
                        </div>
                        <DialogFooter className="sm:justify-start mt-2">
                            <Button type="button" variant="default" onClick={() => {
                                navigator.clipboard.writeText(selectedPfPayload.promptfooSnippet);
                            }} className="gap-2">
                                <Copy className="h-4 w-4" />
                                Copy
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>

            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2">
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
