'use client'

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarClock, Plus, Play, Trash2, Loader2, Globe, Terminal, FileCode2, Activity, CheckCircle2, XCircle, Clock, Pause } from 'lucide-react';
import { getScheduledScans, createScheduledScan, toggleScheduledScan, deleteScheduledScan, runScheduledScanNow } from '@/lib/scheduled-scan-actions';

const SCAN_TYPES = [
    { value: 'network', label: 'Network Probing', icon: Globe, description: 'Scan IP/CIDR for AI services' },
    { value: 'ai_spotter', label: 'AI Spotter', icon: Activity, description: 'Detect AI services in a repository' },
    { value: 'skill_scanner', label: 'Skill Scanner', icon: FileCode2, description: 'Scan skill files for vulnerabilities' },
    { value: 'mcp_scanner', label: 'MCP Scanner', icon: Terminal, description: 'Detect MCP protocol endpoints' },
];

const SCHEDULES = [
    { value: 'once', label: 'Once' },
    { value: 'hourly', label: 'Every Hour' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
];

function statusBadge(status: string) {
    switch (status) {
        case 'completed': return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
        case 'running': return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running</Badge>;
        case 'failed': return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
        default: return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
}

function typeLabel(scanType: string) {
    const t = SCAN_TYPES.find(s => s.value === scanType);
    if (!t) return scanType;
    const Icon = t.icon;
    return <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-muted-foreground" />{t.label}</span>;
}

export default function ScheduledScansPage() {
    const [scans, setScans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

    // Form state
    const [name, setName] = useState('');
    const [scanType, setScanType] = useState('network');
    const [target, setTarget] = useState('');
    const [schedule, setSchedule] = useState('daily');
    // Skill scanner options
    const [optBehavioral, setOptBehavioral] = useState(true);
    const [optLlm, setOptLlm] = useState(false);
    const [optTrigger, setOptTrigger] = useState(false);
    const [optToken, setOptToken] = useState('');
    // MCP options
    const [optSweep, setOptSweep] = useState(false);

    const loadScans = async () => {
        try {
            const data = await getScheduledScans();
            setScans(data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { loadScans(); }, []);

    const handleCreate = () => {
        let scanOptions: any = {};
        if (scanType === 'skill_scanner') {
            scanOptions = { behavioral: optBehavioral, llm: optLlm, trigger: optTrigger };
            if (optToken) scanOptions.token = optToken;
        } else if (scanType === 'ai_spotter' && optToken) {
            scanOptions = { token: optToken };
        } else if (scanType === 'mcp_scanner' && optSweep) {
            scanOptions = { sweep: true, subnet: target };
        }

        startTransition(async () => {
            try {
                await createScheduledScan({
                    name,
                    scanType,
                    target,
                    schedule,
                    scanOptions: Object.keys(scanOptions).length > 0 ? JSON.stringify(scanOptions) : undefined,
                });
                setDialogOpen(false);
                setName(''); setTarget(''); setScanType('network'); setSchedule('daily');
                setOptBehavioral(true); setOptLlm(false); setOptTrigger(false); setOptToken(''); setOptSweep(false);
                await loadScans();
            } catch (e: any) {
                console.error('Create error:', e);
            }
        });
    };

    const handleToggle = (id: string) => {
        startTransition(async () => {
            await toggleScheduledScan(id);
            await loadScans();
        });
    };

    const handleDelete = (id: string) => {
        startTransition(async () => {
            await deleteScheduledScan(id);
            await loadScans();
        });
    };

    const handleRunNow = (id: string) => {
        setRunningIds(prev => new Set(prev).add(id));
        startTransition(async () => {
            try {
                await runScheduledScanNow(id);
            } catch { }
            setRunningIds(prev => { const n = new Set(prev); n.delete(id); return n; });
            await loadScans();
        });
    };

    const targetPlaceholder = () => {
        switch (scanType) {
            case 'network': return '192.168.1.0/24 or 10.0.0.1';
            case 'ai_spotter': return 'https://github.com/user/repo';
            case 'skill_scanner': return 'https://github.com/user/skills-repo';
            case 'mcp_scanner': return 'http://localhost:3000 or 192.168.1.0/24';
            default: return 'Target';
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Scheduled Scans</h1>
                    <p className="text-muted-foreground">Plan and manage recurring scans across all discovery modules.</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2"><Plus className="h-4 w-4" /> New Schedule</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Create Scheduled Scan</DialogTitle>
                            <DialogDescription>Set up a recurring scan targeting a specific asset or module.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Name</label>
                                <Input placeholder="e.g. Daily network probe" value={name} onChange={e => setName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Scan Type</label>
                                <Select value={scanType} onValueChange={setScanType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {SCAN_TYPES.map(t => (
                                            <SelectItem key={t.value} value={t.value}>
                                                <span className="flex items-center gap-2">
                                                    <t.icon className="h-4 w-4" /> {t.label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">{SCAN_TYPES.find(t => t.value === scanType)?.description}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Target</label>
                                <Input placeholder={targetPlaceholder()} value={target} onChange={e => setTarget(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Schedule</label>
                                <Select value={schedule} onValueChange={setSchedule}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {SCHEDULES.map(s => (
                                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Module-specific options */}
                            {(scanType === 'ai_spotter' || scanType === 'skill_scanner') && (
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Access Token (optional)</label>
                                    <Input type="password" placeholder="ghp_xxxx..." value={optToken} onChange={e => setOptToken(e.target.value)} />
                                    <p className="text-xs text-muted-foreground mt-1">Required for private repositories.</p>
                                </div>
                            )}

                            {scanType === 'skill_scanner' && (
                                <div className="space-y-2 rounded-lg border p-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Skill Scanner Options</p>
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="opt-behavioral" checked={optBehavioral} onCheckedChange={(v) => setOptBehavioral(!!v)} />
                                        <label htmlFor="opt-behavioral" className="text-sm">Behavioral Analysis</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="opt-llm" checked={optLlm} onCheckedChange={(v) => setOptLlm(!!v)} />
                                        <label htmlFor="opt-llm" className="text-sm">LLM Analysis</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="opt-trigger" checked={optTrigger} onCheckedChange={(v) => setOptTrigger(!!v)} />
                                        <label htmlFor="opt-trigger" className="text-sm">Trigger Analysis</label>
                                    </div>
                                </div>
                            )}

                            {scanType === 'mcp_scanner' && (
                                <div className="flex items-center gap-2 rounded-lg border p-3">
                                    <Checkbox id="opt-sweep" checked={optSweep} onCheckedChange={(v) => setOptSweep(!!v)} />
                                    <label htmlFor="opt-sweep" className="text-sm">Network Sweep (scan entire subnet)</label>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={!name || !target || isPending}>
                                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Create Schedule
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Schedules</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{scans.length}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Active</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{scans.filter(s => s.enabled).length}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-600">Running Now</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-blue-600">{scans.filter(s => s.status === 'running').length}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-600">{scans.filter(s => s.status === 'failed').length}</div></CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card>
                <CardHeader>
                    <CardTitle>All Scheduled Scans</CardTitle>
                    <CardDescription>Manage your recurring scan jobs across all discovery modules.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : scans.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-40" />
                            <p className="font-medium">No scheduled scans yet</p>
                            <p className="text-sm">Create your first recurring scan to automate discovery.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Target</TableHead>
                                    <TableHead>Schedule</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Run</TableHead>
                                    <TableHead>Enabled</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {scans.map((scan) => {
                                    const isRunning = runningIds.has(scan.id) || scan.status === 'running';
                                    return (
                                        <TableRow key={scan.id}>
                                            <TableCell className="font-medium">{scan.name}</TableCell>
                                            <TableCell>{typeLabel(scan.scanType || 'network')}</TableCell>
                                            <TableCell className="max-w-[200px] truncate font-mono text-xs" title={scan.target}>{scan.target}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="capitalize">{scan.schedule}</Badge>
                                            </TableCell>
                                            <TableCell>{statusBadge(scan.status)}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {scan.lastRun ? new Date(scan.lastRun).toLocaleString() : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Switch checked={scan.enabled} onCheckedChange={() => handleToggle(scan.id)} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex gap-1 justify-end">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2 gap-1"
                                                        disabled={isRunning}
                                                        onClick={() => handleRunNow(scan.id)}
                                                    >
                                                        {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                                        Run
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-7 px-2 text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(scan.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
