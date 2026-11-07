'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSystemSettings, saveSystemSetting } from '@/lib/settings-actions';
import { Settings, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { N8nEnvironmentManager } from '@/components/N8nEnvironmentManager';

export default function SettingsPage() {
    const [settings, setSettings] = useState({
        N8N_BASE_URL: '',
        N8N_API_KEY: '',
        OLLAMA_BASE_URL: '',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLoading(true);
        getSystemSettings().then(s => {
            setSettings(prev => ({
                ...prev,
                N8N_BASE_URL: s.N8N_BASE_URL || '',
                N8N_API_KEY: s.N8N_API_KEY || '',
                OLLAMA_BASE_URL: s.OLLAMA_BASE_URL || '',
                OPENAI_API_KEY: s.OPENAI_API_KEY || '',
                ANTHROPIC_API_KEY: s.ANTHROPIC_API_KEY || '',
            }));
            setLoading(false);
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveSystemSetting('N8N_BASE_URL', settings.N8N_BASE_URL);
            await saveSystemSetting('N8N_API_KEY', settings.N8N_API_KEY, true);
            await saveSystemSetting('OLLAMA_BASE_URL', settings.OLLAMA_BASE_URL);
            await saveSystemSetting('OPENAI_API_KEY', settings.OPENAI_API_KEY, true);
            await saveSystemSetting('ANTHROPIC_API_KEY', settings.ANTHROPIC_API_KEY, true);
            toast.success('Settings saved successfully');
        } catch (error) {
            toast.error('Failed to save settings');
        }
        setSaving(false);
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Settings className="h-8 w-8" />
                    System Settings
                </h1>
                <p className="text-muted-foreground">
                    Configure global connection settings for external tools.
                </p>
            </div>

            <div className="grid gap-6 max-w-2xl">
                <N8nEnvironmentManager />

                <Card>
                    <CardHeader>
                        <CardTitle>AI Configuration</CardTitle>
                        <CardDescription>
                            Configure Local LLM provider (Ollama) for dynamic analysis.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Ollama URL</Label>
                            <Input
                                value={settings.OLLAMA_BASE_URL}
                                onChange={e => setSettings({ ...settings, OLLAMA_BASE_URL: e.target.value })}
                                placeholder="http://localhost:11434"
                            />
                            <p className="text-xs text-muted-foreground">
                                Used for "Dynamic (AI Generated)" attacks. Default: <code>http://localhost:11434</code>
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>LLM Semantic Analysis</CardTitle>
                        <CardDescription>
                            API keys for LLM-powered semantic analysis engines used in Skill Scanner and other tools.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>OpenAI API Key</Label>
                            <Input
                                type="password"
                                value={settings.OPENAI_API_KEY}
                                onChange={e => setSettings({ ...settings, OPENAI_API_KEY: e.target.value })}
                                placeholder="sk-..."
                            />
                            <p className="text-xs text-muted-foreground">
                                Required for OpenAI-based LLM semantic analysis in Skill Scanner.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Anthropic API Key</Label>
                            <Input
                                type="password"
                                value={settings.ANTHROPIC_API_KEY}
                                onChange={e => setSettings({ ...settings, ANTHROPIC_API_KEY: e.target.value })}
                                placeholder="sk-ant-..."
                            />
                            <p className="text-xs text-muted-foreground">
                                Required for Claude-based semantic analysis. Used as an alternative to OpenAI.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Configuration
                    </Button>
                </div>
            </div>
        </div>
    );
}
