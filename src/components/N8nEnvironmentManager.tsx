'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getEnvironments, createEnvironment, updateEnvironment, deleteEnvironment } from '@/lib/actions';
import { Loader2, Plus, Trash2, Edit2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function N8nEnvironmentManager() {
    const [environments, setEnvironments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fetchingVersion, setFetchingVersion] = useState(false);

    // Form state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', baseUrl: '', apiKey: '', version: '', isActive: true });

    useEffect(() => {
        fetchEnvironments();
    }, []);

    const fetchEnvironments = async () => {
        setLoading(true);
        try {
            const data = await getEnvironments();
            setEnvironments(data);
        } catch (error) {
            console.error("Failed to fetch environments", error);
        }
        setLoading(false);
    };

    const handleEdit = (env: any) => {
        setEditingId(env.id);
        setFormData({ name: env.name, baseUrl: env.baseUrl, apiKey: env.apiKey || '', version: env.version || '', isActive: env.isActive });
    };

    const handleCancel = () => {
        setEditingId(null);
        setFormData({ name: '', baseUrl: '', apiKey: '', version: '', isActive: true });
    };

    const handleAutoFetchVersion = async () => {
        if (!formData.baseUrl) {
            toast.error("Please enter a Base URL first.");
            return;
        }

        setFetchingVersion(true);
        try {
            const response = await fetch('/api/n8n/version', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseUrl: formData.baseUrl })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.version) {
                    setFormData(prev => ({ ...prev, version: data.version }));
                    toast.success(`Found version: ${data.version}`);
                } else {
                    toast.error("Could not automatically detect version.");
                }
            } else {
                toast.error("Failed to fetch version.");
            }
        } catch (error) {
            toast.error("Error communicating with server.");
        }
        setFetchingVersion(false);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.baseUrl) {
            toast.error("Name and Base URL are required.");
            return;
        }

        setSaving(true);
        try {
            if (editingId) {
                await updateEnvironment(editingId, formData);
                toast.success('Environment updated!');
            } else {
                await createEnvironment(formData);
                toast.success('Environment created!');
            }
            fetchEnvironments();
            handleCancel();
        } catch (error) {
            toast.error('Failed to save environment');
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this environment? It may break existing workflows.')) return;
        setSaving(true);
        try {
            await deleteEnvironment(id);
            toast.success('Environment deleted');
            fetchEnvironments();
        } catch (error) {
            toast.error('Failed to delete environment');
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>N8n Environments</CardTitle>
                    <CardDescription>Manage multiple n8n instances.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center p-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>N8n Environments</CardTitle>
                <CardDescription>
                    Connect multiple n8n instances across different environments (Staging, Production, Local).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* List of Environments */}
                <div className="space-y-3">
                    {environments.length === 0 ? (
                        <div className="text-sm text-muted-foreground italic border border-dashed rounded p-4 text-center">
                            No environments configured yet.
                        </div>
                    ) : (
                        environments.map(env => (
                            <div key={env.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-md shadow-sm gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">{env.name}</span>
                                        {env.isActive ? (
                                            <span className="flex items-center text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                                            </span>
                                        ) : (
                                            <span className="flex items-center text-xs text-muted-foreground bg-gray-100 px-1.5 py-0.5 rounded border">
                                                <XCircle className="w-3 h-3 mr-1" /> Inactive
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono mt-1">
                                        {env.baseUrl}
                                        {env.version && <span className="ml-2 px-1.5 py-0.5 bg-secondary rounded text-[10px] border">v{env.version}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(env)}>
                                        <Edit2 className="w-4 h-4 mr-1" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(env.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Form */}
                <div className="border rounded-md p-4 bg-muted/30">
                    <h3 className="font-medium mb-4 flex items-center gap-2">
                        {editingId ? <><Edit2 className="w-4 h-4" /> Edit Environment</> : <><Plus className="w-4 h-4" /> Add New Environment</>}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                placeholder="e.g. Production n8n"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Base URL</Label>
                            <Input
                                placeholder="https://n8n.yourcompany.com"
                                value={formData.baseUrl}
                                onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input
                                type="password"
                                placeholder="Your n8n API Key..."
                                value={formData.apiKey}
                                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Version (Optional)</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="e.g. 1.0.0"
                                    value={formData.version}
                                    onChange={e => setFormData({ ...formData, version: e.target.value })}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleAutoFetchVersion}
                                    disabled={fetchingVersion || !formData.baseUrl}
                                    title="Auto-detect version from URL"
                                >
                                    {fetchingVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Used for security vulnerability tracking.</p>
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2 mt-2">
                            <input
                                type="checkbox"
                                id="isActive"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                className="rounded border-gray-300"
                            />
                            <Label htmlFor="isActive" className="cursor-pointer">Active (include in workflow sync)</Label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        {editingId && (
                            <Button variant="outline" onClick={handleCancel} disabled={saving}>
                                Cancel
                            </Button>
                        )}
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingId ? 'Save Changes' : 'Add Environment'}
                        </Button>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
