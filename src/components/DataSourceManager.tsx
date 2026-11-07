'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Key, Copy, Database, Server, Wifi, Settings, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { toggleDataSource, deleteDataSource, createDataSource, generateApiKey } from '@/lib/data-source-actions';

type DataSource = {
    id: string;
    name: string;
    type: string;
    enabled: boolean;
    config: string | null;
    endpoint: string | null;
    lastActivity: Date | null;
    requestCount: number;
    createdAt: Date;
};

const typeIcons: Record<string, React.ReactNode> = {
    scanner: <Server className="h-4 w-4" />,
    api: <Database className="h-4 w-4" />,
    proxy: <Wifi className="h-4 w-4" />,
    kafka: <Settings className="h-4 w-4" />
};

const typeColors: Record<string, string> = {
    scanner: 'text-blue-500',
    api: 'text-green-500',
    proxy: 'text-purple-500',
    kafka: 'text-orange-500'
};

export function DataSourceManager({ initialSources }: { initialSources: DataSource[] }) {
    const [sources, setSources] = useState<DataSource[]>(initialSources);
    const [isOpen, setIsOpen] = useState(false);
    const [newSource, setNewSource] = useState({ name: '', type: 'api' });
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);

    const handleToggle = async (id: string) => {
        try {
            const updated = await toggleDataSource(id);
            setSources(sources.map(s => s.id === id ? { ...s, enabled: updated.enabled } : s));
            toast.success(updated.enabled ? 'Source enabled' : 'Source disabled');
        } catch (error) {
            toast.error('Failed to toggle source');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDataSource(id);
            setSources(sources.filter(s => s.id !== id));
            toast.success('Source deleted');
        } catch (error) {
            toast.error('Failed to delete source');
        }
    };

    const handleCreate = async () => {
        if (!newSource.name.trim()) {
            toast.error('Name is required');
            return;
        }

        try {
            const created = await createDataSource({
                name: newSource.name,
                type: newSource.type as any
            });
            setSources([created as DataSource, ...sources]);
            toast.success('Source created');
            setNewSource({ name: '', type: 'api' });
            setIsOpen(false);
        } catch (error) {
            toast.error('Failed to create source');
        }
    };

    const handleGenerateKey = async (id: string) => {
        try {
            const key = await generateApiKey(id);
            setGeneratedKey(key);
            setSources(sources.map(s => s.id === id ? { ...s, endpoint: key } : s));
            toast.success('API key generated');
        } catch (error) {
            toast.error('Failed to generate key');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    return (
        <div className="space-y-4">
            {/* Add Source Button */}
            <div className="flex justify-end">
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Source
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Data Source</DialogTitle>
                            <DialogDescription>Configure a new source for LLM traffic collection</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={newSource.name}
                                    onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                                    placeholder="e.g., Production API Logs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select value={newSource.type} onValueChange={(v) => setNewSource({ ...newSource, type: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="api">API Ingestion</SelectItem>
                                        <SelectItem value="scanner">Network Scanner</SelectItem>
                                        <SelectItem value="proxy">HTTP Proxy</SelectItem>
                                        <SelectItem value="kafka">Kafka Stream</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate}>Create</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Generated Key Modal */}
            {generatedKey && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-green-500">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">API Key Generated</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Save this key now - it won't be shown again!</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-background rounded px-3 py-2 text-sm font-mono truncate">
                            {generatedKey}
                        </code>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedKey)}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setGeneratedKey(null)}>
                        Dismiss
                    </Button>
                </div>
            )}

            {/* Sources List */}
            <div className="space-y-3">
                {sources.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No data sources configured</p>
                    </div>
                ) : (
                    sources.map((source) => (
                        <div
                            key={source.id}
                            className={`flex items-center justify-between p-4 rounded-lg border ${source.enabled ? 'bg-card' : 'bg-muted/30 opacity-60'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center bg-primary/10 ${typeColors[source.type]}`}>
                                    {typeIcons[source.type]}
                                </div>
                                <div>
                                    <p className="font-medium">{source.name}</p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Badge variant="outline" className="text-xs capitalize">{source.type}</Badge>
                                        <span>•</span>
                                        <span>{source.requestCount} requests</span>
                                        {source.lastActivity && (
                                            <>
                                                <span>•</span>
                                                <span>Last: {new Date(source.lastActivity).toLocaleTimeString()}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {source.type === 'api' && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1"
                                        onClick={() => handleGenerateKey(source.id)}
                                    >
                                        <Key className="h-3 w-3" />
                                        {source.endpoint ? 'Regenerate Key' : 'Generate Key'}
                                    </Button>
                                )}
                                <Switch
                                    checked={source.enabled}
                                    onCheckedChange={() => handleToggle(source.id)}
                                />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                    onClick={() => handleDelete(source.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
