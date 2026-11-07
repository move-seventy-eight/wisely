'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Play, Clock, Calendar, CheckCircle, XCircle, Loader2, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { createScheduledScan, toggleScheduledScan, deleteScheduledScan, runScheduledScanNow } from '@/lib/scheduled-scan-actions';

type ScheduledScan = {
    id: string;
    name: string;
    target: string;
    schedule: string;
    enabled: boolean;
    status: string;
    lastRun: Date | null;
    nextRun: Date | null;
    lastResult: string | null;
    createdAt: Date;
};

const scheduleLabels: Record<string, string> = {
    once: 'One-time',
    hourly: 'Hourly',
    daily: 'Daily',
    weekly: 'Weekly'
};

const statusIcons: Record<string, React.ReactNode> = {
    pending: <Timer className="h-4 w-4 text-blue-500" />,
    running: <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />,
    completed: <CheckCircle className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />
};

export function ScanScheduler({ initialScans, defaultScanType = 'network' }: { initialScans: ScheduledScan[], defaultScanType?: string }) {
    const [scans, setScans] = useState<ScheduledScan[]>(initialScans);
    const [isOpen, setIsOpen] = useState(false);
    const [isRunning, setIsRunning] = useState<string | null>(null);
    const [newScan, setNewScan] = useState({ name: '', target: '', schedule: 'once', scanType: defaultScanType });

    const handleCreate = async () => {
        if (!newScan.name.trim() || !newScan.target.trim()) {
            toast.error('Name and target are required');
            return;
        }

        try {
            const created = await createScheduledScan(newScan);
            setScans([created as ScheduledScan, ...scans]);
            toast.success('Scheduled scan created');
            setNewScan({ name: '', target: '', schedule: 'once', scanType: defaultScanType });
            setIsOpen(false);
        } catch (error) {
            toast.error('Failed to create scheduled scan');
        }
    };

    const handleToggle = async (id: string) => {
        try {
            const updated = await toggleScheduledScan(id);
            setScans(scans.map(s => s.id === id ? { ...s, enabled: updated.enabled, nextRun: updated.nextRun } : s));
            toast.success(updated.enabled ? 'Scan enabled' : 'Scan disabled');
        } catch (error) {
            toast.error('Failed to toggle scan');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteScheduledScan(id);
            setScans(scans.filter(s => s.id !== id));
            toast.success('Scheduled scan deleted');
        } catch (error) {
            toast.error('Failed to delete scan');
        }
    };

    const handleRunNow = async (id: string) => {
        setIsRunning(id);
        try {
            const res = await runScheduledScanNow(id) as any;
            const count = res?.results?.length || res?.result?.length || 0;
            setScans(scans.map(s => s.id === id ? {
                ...s,
                status: 'completed',
                lastRun: new Date(),
                lastResult: JSON.stringify({ servicesFound: count })
            } : s));
            toast.success(`Scan completed: ${count} services found`);
        } catch (error: any) {
            setScans(scans.map(s => s.id === id ? { ...s, status: 'failed' } : s));
            toast.error(error.message || 'Scan failed');
        } finally {
            setIsRunning(null);
        }
    };

    const parseResult = (result: string | null): { servicesFound?: number; error?: string } => {
        if (!result) return {};
        try {
            return JSON.parse(result);
        } catch {
            return {};
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Scheduled Scans</h3>
                    <p className="text-sm text-muted-foreground">Configure recurring network scans</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Schedule Scan
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Schedule Network Scan</DialogTitle>
                            <DialogDescription>Create a one-time or recurring scan</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={newScan.name}
                                    onChange={(e) => setNewScan({ ...newScan, name: e.target.value })}
                                    placeholder="e.g., Nightly LLM Scan"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="target">Target</Label>
                                <Input
                                    id="target"
                                    value={newScan.target}
                                    onChange={(e) => setNewScan({ ...newScan, target: e.target.value })}
                                    placeholder="e.g., 192.168.1.0/24 or ollama.local"
                                />
                                <p className="text-xs text-muted-foreground">
                                    IP address, CIDR range, or hostname
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="schedule">Schedule</Label>
                                <Select value={newScan.schedule} onValueChange={(v) => setNewScan({ ...newScan, schedule: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="once">One-time (run immediately)</SelectItem>
                                        <SelectItem value="hourly">Hourly</SelectItem>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate}>Create Schedule</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Scans List */}
            <div className="space-y-3">
                {scans.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No scheduled scans</p>
                        <p className="text-sm">Create a schedule to automate network discovery</p>
                    </div>
                ) : (
                    scans.map((scan) => {
                        const result = parseResult(scan.lastResult);
                        return (
                            <div
                                key={scan.id}
                                className={`flex items-center justify-between p-4 rounded-lg border ${scan.enabled ? 'bg-card' : 'bg-muted/30 opacity-70'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10">
                                        <Clock className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{scan.name}</p>
                                            <Badge variant="outline" className="text-xs">
                                                {scheduleLabels[scan.schedule] || scan.schedule}
                                            </Badge>
                                            <div className="flex items-center gap-1">
                                                {statusIcons[scan.status]}
                                                <span className="text-xs text-muted-foreground capitalize">{scan.status}</span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-muted-foreground font-mono">{scan.target}</p>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                            {scan.lastRun && (
                                                <span>Last: {new Date(scan.lastRun).toLocaleString()}</span>
                                            )}
                                            {scan.nextRun && scan.enabled && (
                                                <span>Next: {new Date(scan.nextRun).toLocaleString()}</span>
                                            )}
                                            {result.servicesFound !== undefined && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {result.servicesFound} services found
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1"
                                        onClick={() => handleRunNow(scan.id)}
                                        disabled={isRunning === scan.id}
                                    >
                                        {isRunning === scan.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Play className="h-3 w-3" />
                                        )}
                                        Run Now
                                    </Button>
                                    <Switch
                                        checked={scan.enabled}
                                        onCheckedChange={() => handleToggle(scan.id)}
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                        onClick={() => handleDelete(scan.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
