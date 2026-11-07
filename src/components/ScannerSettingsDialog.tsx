'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { useCustomPatterns } from "@/hooks/useCustomPatterns";
import { CustomPattern } from "@/lib/secret-scanner";

export function ScannerSettingsDialog() {
    const [patterns, setPatterns, loading] = useCustomPatterns();
    const [newRegex, setNewRegex] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newSeverity, setNewSeverity] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM'>('MEDIUM');

    const handleAddPattern = async () => {
        if (!newRegex || !newDesc) return;
        try {
            new RegExp(newRegex); // validate regex format
            const pt: CustomPattern = {
                regex: newRegex,
                type: 'CUSTOM',
                description: newDesc,
                severity: newSeverity
            };

            // Auto-save via hook
            await setPatterns(prev => [...prev, pt]);

            setNewRegex('');
            setNewDesc('');
        } catch (e) {
            alert('Invalid Regular Expression');
        }
    };

    const handleRemovePattern = async (idx: number) => {
        // Auto-save via hook
        await setPatterns(prev => prev.filter((_, i) => i !== idx));
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 bg-background border shadow-sm hover:bg-muted/50 transition-colors">
                    <Settings className="h-4 w-4" />
                    Scanner Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ShieldCheck className="h-5 w-5 text-indigo-500" />
                        Scanner Settings
                    </DialogTitle>
                    <DialogDescription>
                        Configure global patterns for security scanners. Changes are saved automatically.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    <div className="space-y-4">
                        <Label className="text-sm font-semibold">Custom Secret Patterns</Label>
                        {loading ? (
                            <div className="py-8 flex justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {patterns.length === 0 ? (
                                    <div className="rounded-md border border-dashed p-6 text-center bg-muted/20">
                                        <p className="text-sm text-muted-foreground">No custom patterns defined.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-2">
                                        {patterns.map((p, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow">
                                                <div className="space-y-1 min-w-0">
                                                    <div className="font-semibold flex items-center gap-2 text-sm">
                                                        <span className="truncate">{p.description}</span>
                                                        <Badge variant={p.severity === 'CRITICAL' ? 'destructive' : p.severity === 'HIGH' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                                                            {p.severity}
                                                        </Badge>
                                                    </div>
                                                    <code className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded block truncate">
                                                        {p.regex.toString()}
                                                    </code>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0 h-8 w-8"
                                                    onClick={() => handleRemovePattern(idx)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                        <h4 className="text-sm font-medium flex items-center gap-2 text-foreground/80">
                            <Plus className="h-4 w-4" /> Add New Pattern
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
                                <Input
                                    placeholder="e.g. Acme API Key"
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Regular Expression</Label>
                                <Input
                                    placeholder="e.g. acme_[a-z0-9]{32}"
                                    value={newRegex}
                                    onChange={(e) => setNewRegex(e.target.value)}
                                    className="font-mono h-9"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1 space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Severity</Label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={newSeverity}
                                    onChange={(e) => setNewSeverity(e.target.value as 'CRITICAL' | 'HIGH' | 'MEDIUM')}
                                >
                                    <option value="CRITICAL">Critical</option>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                </select>
                            </div>
                            <Button
                                onClick={handleAddPattern}
                                disabled={!newRegex || !newDesc}
                                className="mt-6 h-9 px-6 bg-indigo-600 hover:bg-indigo-700"
                            >
                                Add Pattern
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
