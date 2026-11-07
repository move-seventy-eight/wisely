'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, RefreshCw, ShieldCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { verifyAssets } from "@/lib/scan-actions";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { CiscoModelScore } from '@/components/CiscoModelScore';
import type { CiscoModelScoreMatch } from '@/lib/cisco-leaderboard';

interface Asset {
    id: number;
    ip: string;
    port: number;
    name: string;
    details: string | null;
    models: string | null;
    status: string; // Added status
    lastVerifiedAt: Date | null; // Added lastVerifiedAt
    scanResult: {
        scannedAt: Date;
    } | null;
}

function parseModels(value: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? parsed.filter((model): model is string => typeof model === 'string') : [];
    } catch {
        return [];
    }
}

export function InventoryTable({
    assets,
    modelScores,
    leaderboardAvailable,
}: {
    assets: Asset[];
    modelScores: Record<string, CiscoModelScoreMatch | null>;
    leaderboardAvailable: boolean;
}) {
    // ... existing state ...
    const [search, setSearch] = useState('');
    const [serviceFilter, setServiceFilter] = useState<string>('all');
    const [portFilter, setPortFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    const [currentPage, setCurrentPage] = useState(1);
    const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
    const [verifying, setVerifying] = useState(false);
    const ITEMS_PER_PAGE = 10;

    const filteredAssets = assets.filter(asset => {
        const matchesSearch =
            asset.ip.includes(search) ||
            asset.name.toLowerCase().includes(search.toLowerCase()) ||
            (asset.details && asset.details.toLowerCase().includes(search.toLowerCase())) ||
            (asset.models && asset.models.toLowerCase().includes(search.toLowerCase()));

        const matchesService = serviceFilter === 'all' || asset.name === serviceFilter;
        const matchesPort = portFilter === '' || asset.port.toString().includes(portFilter);
        const matchesStatus = statusFilter === 'all' || (asset.status || 'OPEN') === statusFilter;

        return matchesSearch && matchesService && matchesPort && matchesStatus;
    });

    const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
    const currentAssets = filteredAssets.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Extract unique service names for the filter dropdown
    const serviceTypes = Array.from(new Set(assets.map(a => a.name))).sort();

    const resetFilters = () => {
        setSearch('');
        setServiceFilter('all');
        setStatusFilter('all');
        setPortFilter('');
        setCurrentPage(1);
    };

    const toggleSelectAll = () => {
        if (selectedAssets.length === filteredAssets.length) {
            setSelectedAssets([]);
        } else {
            setSelectedAssets(filteredAssets.map(a => `${a.ip}:${a.port}`));
        }
    };

    const toggleSelect = (key: string) => {
        if (selectedAssets.includes(key)) {
            setSelectedAssets(selectedAssets.filter(k => k !== key));
        } else {
            setSelectedAssets([...selectedAssets, key]);
        }
    };

    const handleBulkVerify = async () => {
        if (selectedAssets.length === 0) return;
        setVerifying(true);
        const targets = selectedAssets.map(k => {
            const [ip, port] = k.split(':');
            return { ip, port: parseInt(port) };
        });

        toast.promise(verifyAssets(targets), {
            loading: `Verifying ${targets.length} assets...`,
            success: (results) => {
                setVerifying(false);
                setSelectedAssets([]);
                window.location.reload();
                return `Verification complete. ${results.filter(r => r.status === 'OPEN').length} OPEN, ${results.filter(r => r.status === 'CLOSED').length} CLOSED.`;
            },
            error: "Verification failed",
        });
    };

    const handleExportCSV = () => {
        if (filteredAssets.length === 0) {
            toast.error('No assets to export');
            return;
        }

        const headers = ['IP', 'Port', 'Service', 'Models', 'Cisco Security Scores', 'Status', 'Last Verified', 'Details'];
        const csvRows = [headers.join(',')];

        filteredAssets.forEach(asset => {
            const models = parseModels(asset.models);
            const modelsStr = models.join('; ');
            const ciscoScores = models
                .map((model) => modelScores[model]?.combined_score.toFixed(1))
                .filter(Boolean)
                .join('; ');
            const dateStr = asset.lastVerifiedAt
                ? new Date(asset.lastVerifiedAt).toLocaleString()
                : (asset.scanResult?.scannedAt ? new Date(asset.scanResult.scannedAt).toLocaleDateString() : 'Never');

            const row = [
                `"${asset.ip}"`,
                asset.port,
                `"${asset.name}"`,
                `"${modelsStr}"`,
                `"${ciscoScores}"`,
                asset.status || 'OPEN',
                `"${dateStr}"`,
                `"${(asset.details || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'asset_inventory.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Asset inventory exported as CSV');
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex flex-1 items-center gap-2 flex-wrap">
                    <div className="relative flex-1 md:max-w-xs min-w-[200px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search IP, Service..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Service" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Services</SelectItem>
                            {serviceTypes.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="OPEN">Open</SelectItem>
                            <SelectItem value="CLOSED">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        placeholder="Port..."
                        className="w-[80px]"
                        value={portFilter}
                        onChange={(e) => { setPortFilter(e.target.value); setCurrentPage(1); }}
                    />
                </div>

                <div className="flex items-center gap-2">
                    {selectedAssets.length > 0 && (
                        <Button
                            onClick={handleBulkVerify}
                            disabled={verifying}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {verifying ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                            Verify ({selectedAssets.length})
                        </Button>
                    )}

                    {(search || serviceFilter !== 'all' || statusFilter !== 'all' || portFilter) && (
                        <Button variant="ghost" onClick={resetFilters} className="h-8 px-2 lg:px-3">
                            Reset
                            <X className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleExportCSV} className="ml-auto h-8 px-2 lg:px-3">
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]"><Checkbox checked={filteredAssets.length > 0 && selectedAssets.length === filteredAssets.length} onCheckedChange={toggleSelectAll} /></TableHead>
                            <TableHead>Asset</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Models</TableHead>
                            <TableHead>Cisco Security</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Verified</TableHead>
                            <TableHead>Details</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentAssets.map((asset) => {
                            const key = `${asset.ip}:${asset.port}`;
                            const isSelected = selectedAssets.includes(key);
                            const models = parseModels(asset.models);
                            return (
                                <TableRow key={key} data-state={isSelected ? "selected" : undefined}>
                                    <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(key)} /></TableCell>
                                    <TableCell className="font-mono text-sm">
                                        <div className="font-semibold">{asset.ip}</div>
                                        <div className="text-muted-foreground text-xs">Port: {asset.port}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-primary/5 border-primary/20">
                                            {asset.name}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {models.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {models.slice(0, 2).map((model) => (
                                                    <Badge key={model} variant="secondary" className="text-[10px] px-1 h-5 bg-purple-500/10 text-purple-700 border-purple-200">
                                                        {model}
                                                    </Badge>
                                                ))}
                                                {models.length > 2 && <span className="text-[10px] text-muted-foreground">+{models.length - 2}</span>}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {models.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {models.slice(0, 2).map((model) => (
                                                    <div key={model} className="flex items-center gap-2">
                                                        <span className="max-w-[100px] truncate text-[10px] text-muted-foreground" title={model}>{model}</span>
                                                        <CiscoModelScore
                                                            match={modelScores[model]}
                                                            leaderboardAvailable={leaderboardAvailable}
                                                            compact
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={asset.status === 'CLOSED' ? "destructive" : "default"} className={asset.status === 'OPEN' ? "bg-green-500 hover:bg-green-600" : ""}>
                                            {asset.status || 'OPEN'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {asset.lastVerifiedAt ? new Date(asset.lastVerifiedAt).toLocaleString() : (asset.scanResult?.scannedAt ? new Date(asset.scanResult.scannedAt).toLocaleDateString() : '-')}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate" title={asset.details || ''}>
                                        {asset.details || '-'}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {currentAssets.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No assets match your filters.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground mt-4">
                <div>
                    Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredAssets.length)} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAssets.length)} of {filteredAssets.length} assets
                    {selectedAssets.length > 0 && ` (${selectedAssets.length} selected)`}
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                        >
                            Previous
                        </Button>
                        <span className="px-2 text-sm">{currentPage} / {totalPages}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
