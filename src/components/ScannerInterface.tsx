'use client'

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, History, ChevronRight, ChevronDown } from 'lucide-react';
import { scanAction, getPastScans } from '@/lib/scan-actions';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ScannerInterface() {
    const [target, setTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const data = await getPastScans();
            setHistory(data);
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };

    const handleScan = async () => {
        if (!target) return;
        setLoading(true);
        setError('');
        setResults([]);
        try {
            const data = await scanAction(target);
            setResults(data);
            await loadHistory();
        } catch (error: any) {
            console.error(error);
            setError(error.message || "Scan failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in duration-500">
            <div className="lg:col-span-2 space-y-6">
                <Card className="border-none shadow-sm bg-gradient-to-br from-card to-secondary/10">
                    <CardHeader>
                        <CardTitle>New Scan</CardTitle>
                        <CardDescription>Enter IP address, Domain, or CIDR range (e.g. 192.168.1.0/24)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-4">
                                <Input
                                    placeholder="Target (IP, Domain, CIDR)"
                                    value={target}
                                    onChange={(e) => setTarget(e.target.value)}
                                    className="flex-1 font-mono"
                                    onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                                />
                                <Button onClick={handleScan} disabled={loading || !target} className="w-32">
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                    {loading ? 'Scanning' : 'Scan'}
                                </Button>
                            </div>
                            {error && (
                                <p className="text-sm text-destructive font-medium">{error}</p>
                            )}
                            <div className="text-xs text-muted-foreground">
                                Supported: Single IP (192.168.1.10), CIDR (192.168.1.0/24 - max 256 IPs), Domain (localhost).
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Live Results</CardTitle>
                        <CardDescription>
                            {loading ? "Scanning in progress..." : results.length > 0 ? `Found ${results.length} open ports` : "Ready to scan"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>Port</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Models</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No active scan results.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {results.map((result, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-mono text-xs">{result.ip}</TableCell>
                                        <TableCell className="font-mono text-xs">{result.port}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                                                Open
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-medium">{result.service}</TableCell>
                                        <TableCell>
                                            {result.models && result.models.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {(Array.isArray(result.models) ? result.models : JSON.parse(result.models || '[]')).map((model: string, i: number) => (
                                                        <Badge key={i} variant="secondary" className="text-[10px] px-1 h-5 bg-purple-500/10 text-purple-700 border-purple-200">
                                                            {model}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground font-mono max-w-[200px] truncate">
                                            {result.details && JSON.stringify(result.details)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-1">
                <Card className="h-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-4 w-4" />
                            Scan History
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[600px] px-4">
                            <div className="space-y-4 pb-4">
                                {history.map((scan) => (
                                    <div key={scan.id} className="rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-semibold truncate max-w-[150px]" title={scan.target}>{scan.target}</span>
                                            <span className="text-xs text-muted-foreground">{new Date(scan.scannedAt).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-2">
                                            {scan.services.length} services detected
                                        </div>
                                        {scan.services.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {scan.services.slice(0, 3).map((s: any) => (
                                                    <Badge key={s.id} variant="secondary" className="text-[10px] px-1 h-5">
                                                        {s.name}
                                                    </Badge>
                                                ))}
                                                {scan.services.length > 3 && (
                                                    <span className="text-[10px] text-muted-foreground">+{scan.services.length - 3}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {history.length === 0 && (
                                    <div className="py-8 text-center text-muted-foreground text-xs">
                                        No past scans found.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
