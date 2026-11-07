'use client'

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CalendarClock, Plus, Play, Trash2, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getScheduledScans, createScheduledScan, toggleScheduledScan, deleteScheduledScan, runScheduledScanNow } from '@/lib/scheduled-scan-actions';

const SCHEDULES = [
    { value: 'once', label: 'Once' },
    { value: 'hourly', label: 'Every Hour' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
];

function statusBadge(status: string) {
    switch (status) {
        case 'completed': return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Done</Badge>;
        case 'running': return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px] animate-pulse"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
        case 'failed': return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-[10px]"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
        default: return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px]"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
}

interface ScheduleSectionProps {
    scanType: string;
    targetPlaceholder?: string;
    /** Extra scanOptions JSON fields merged into the created schedule */
    extraOptions?: Record<string, any>;
}

/**
 * Embeddable scheduled scans section — filtered to a single scanType.
 * Drop this into any scanner page.
 */
export function ScheduleSection({ scanType, targetPlaceholder = 'Target', extraOptions }: ScheduleSectionProps) {
    const [scans, setScans] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

    const [name, setName] = useState('');
    const [target, setTarget] = useState('');
    const [schedule, setSchedule] = useState('daily');
    const [token, setToken] = useState('');

    // Skill Scanner specific options
    const [behavioral, setBehavioral] = useState(true);
    const [llm, setLlm] = useState(false);
    const [trigger, setTrigger] = useState(false);

    const loadScans = async () => {
        try {
            const all = await getScheduledScans();
            setScans(all.filter((s: any) => (s.scanType || 'network') === scanType));
        } catch { }
    };

    useEffect(() => { loadScans(); }, []);

    const handleCreate = () => {
        startTransition(async () => {
            try {
                const combinedOptions: Record<string, any> = { ...extraOptions };
                if (token) combinedOptions.token = token;

                if (scanType === 'skill_scanner') {
                    combinedOptions.behavioral = behavioral;
                    combinedOptions.llm = llm;
                    combinedOptions.trigger = trigger;
                }

                const opts = Object.keys(combinedOptions).length > 0 ? JSON.stringify(combinedOptions) : undefined;
                await createScheduledScan({ name, scanType, target, schedule, scanOptions: opts });
                setDialogOpen(false);
                setName(''); setTarget(''); setSchedule('daily'); setToken('');
                setBehavioral(true); setLlm(false); setTrigger(false);
                await loadScans();
            } catch (e) { console.error(e); }
        });
    };

    const handleToggle = (id: string) => { startTransition(async () => { await toggleScheduledScan(id); await loadScans(); }); };
    const handleDelete = (id: string) => { startTransition(async () => { await deleteScheduledScan(id); await loadScans(); }); };
    const handleRunNow = (id: string) => {
        setRunningIds(prev => new Set(prev).add(id));
        startTransition(async () => {
            try { await runScheduledScanNow(id); } catch { }
            setRunningIds(prev => { const n = new Set(prev); n.delete(id); return n; });
            await loadScans();
        });
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Scheduled Scans</CardTitle>
                        <CardDescription className="text-xs">Recurring scan schedules for this module</CardDescription>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1 h-7"><Plus className="h-3 w-3" /> Add</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>New Scheduled Scan</DialogTitle>
                                <DialogDescription>Set up a recurring scan for this module.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 py-2">
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Name</label>
                                    <Input placeholder="e.g. Daily check" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Target</label>
                                    <Input placeholder={targetPlaceholder} value={target} onChange={e => setTarget(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1 block">Schedule</label>
                                    <Select value={schedule} onValueChange={setSchedule}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {SCHEDULES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {(scanType === 'ai_spotter' || scanType === 'skill_scanner') && (
                                    <div className="pt-2">
                                        <label className="text-sm font-medium mb-1 block">Token (Optional)</label>
                                        <Input
                                            type="password"
                                            placeholder="Git Auth Token"
                                            value={token}
                                            onChange={e => setToken(e.target.value)}
                                        />
                                    </div>
                                )}

                                {scanType === 'skill_scanner' && (
                                    <div className="space-y-3 pt-2 border-t mt-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Behavioral Engine</Label>
                                            <Switch checked={behavioral} onCheckedChange={setBehavioral} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">LLM Semantic Analysis</Label>
                                            <Switch checked={llm} onCheckedChange={setLlm} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Trigger Specificity</Label>
                                            <Switch checked={trigger} onCheckedChange={setTrigger} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreate} disabled={!name || !target || isPending}>
                                    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Create
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {scans.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No scheduled scans. Click "Add" to create one.</p>
                ) : (
                    <div className="space-y-2">
                        {scans.map(scan => {
                            const isRunning = runningIds.has(scan.id) || scan.status === 'running';
                            return (
                                <div key={scan.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors">
                                    <div className="flex-1 min-w-0 mr-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium truncate">{scan.name}</span>
                                            <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{scan.schedule}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]" title={scan.target}>{scan.target}</span>
                                            {statusBadge(scan.status)}
                                        </div>
                                        {scan.lastRun && <span className="text-[10px] text-muted-foreground">Last: {new Date(scan.lastRun).toLocaleString()}</span>}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Switch checked={scan.enabled} onCheckedChange={() => handleToggle(scan.id)} className="scale-75" />
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={isRunning} onClick={() => handleRunNow(scan.id)}>
                                            {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(scan.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
