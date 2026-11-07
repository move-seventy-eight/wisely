'use client';

import { useState } from 'react';
import { createDetectionRule, toggleDetectionRule, deleteDetectionRule } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Code, Type, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface Rule {
    id: string;
    name: string;
    type: string;
    pattern: string;
    severity: string;
    points: number;
    enabled: boolean;
}

export function RuleManager({ initialRules }: { initialRules: Rule[] }) {
    const [rules, setRules] = useState<Rule[]>(initialRules);
    const [isOpen, setIsOpen] = useState(false);
    const [newRule, setNewRule] = useState({
        name: '',
        type: 'keyword',
        pattern: '',
        severity: 'medium',
        points: 20
    });

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            await toggleDetectionRule(id, enabled);
            setRules(rules.map(r => r.id === id ? { ...r, enabled } : r));
            toast.success(`Rule ${enabled ? 'enabled' : 'disabled'}`);
        } catch (e) {
            toast.error('Failed to update rule');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDetectionRule(id);
            setRules(rules.filter(r => r.id !== id));
            toast.success('Rule deleted');
        } catch (e) {
            toast.error('Failed to delete rule');
        }
    };

    const handleCreate = async () => {
        if (!newRule.name || !newRule.pattern) {
            toast.error('Name and pattern are required');
            return;
        }
        try {
            const created = await createDetectionRule(newRule);
            setRules([created as any, ...rules]);
            setNewRule({ name: '', type: 'keyword', pattern: '', severity: 'medium', points: 20 });
            setIsOpen(false);
            toast.success('Rule created');
        } catch (e) {
            toast.error('Failed to create rule');
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'destructive';
            case 'high': return 'destructive';
            case 'medium': return 'secondary';
            default: return 'outline';
        }
    };

    return (
        <div className="space-y-4">
            {/* Add Rule Button */}
            <div className="flex justify-end">
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Rule
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Detection Rule</DialogTitle>
                            <DialogDescription>Add a new pattern to detect sensitive data</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Rule Name</Label>
                                <Input
                                    placeholder="e.g., Credit Card Number"
                                    value={newRule.name}
                                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select value={newRule.type} onValueChange={(v) => setNewRule({ ...newRule, type: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="keyword">Keyword</SelectItem>
                                            <SelectItem value="regex">Regex</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Severity</Label>
                                    <Select value={newRule.severity} onValueChange={(v) => setNewRule({ ...newRule, severity: v })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="critical">Critical</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Pattern</Label>
                                <Input
                                    placeholder={newRule.type === 'regex' ? '\\b\\d{4}-\\d{4}-\\d{4}-\\d{4}\\b' : 'password'}
                                    value={newRule.pattern}
                                    onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Risk Points (0-100)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={newRule.points}
                                    onChange={(e) => setNewRule({ ...newRule, points: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate}>Create Rule</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Rules List */}
            <div className="space-y-2">
                {rules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                        <Shield className="h-12 w-12 mb-4 opacity-20" />
                        <p>No detection rules configured</p>
                    </div>
                ) : (
                    rules.map((rule) => (
                        <div key={rule.id} className={`flex items-center justify-between p-4 rounded-lg border ${rule.enabled ? 'bg-card' : 'bg-muted/30 opacity-60'}`}>
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    {rule.type === 'regex' ? <Code className="h-5 w-5 text-primary" /> : <Type className="h-5 w-5 text-primary" />}
                                </div>
                                <div>
                                    <p className="font-medium">{rule.name}</p>
                                    <p className="text-sm text-muted-foreground font-mono truncate max-w-[300px]">{rule.pattern}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Badge variant={getSeverityColor(rule.severity) as any}>{rule.severity}</Badge>
                                <span className="text-sm text-muted-foreground">{rule.points} pts</span>
                                <Switch checked={rule.enabled} onCheckedChange={(v) => handleToggle(rule.id, v)} />
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
