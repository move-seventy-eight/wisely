import { getDataSources, seedDefaultDataSources, generateApiKey, toggleDataSource, deleteDataSource, createDataSource } from '@/lib/data-source-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Settings, Database, Wifi, Server, Key, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { DataSourceManager } from '@/components/DataSourceManager';

export const dynamic = 'force-dynamic';

export default async function DataSourcesPage() {
    // Seed default sources on first visit
    await seedDefaultDataSources();

    const dataSources = await getDataSources();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/shadow-ai" className="p-2 rounded-lg hover:bg-accent transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
                    <p className="text-muted-foreground">Configure how LLM traffic is collected and analyzed</p>
                </div>
            </div>

            {/* Source Types Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Network Scanner</CardTitle>
                        <Server className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            Automatic discovery of LLM services on your network
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">API Ingestion</CardTitle>
                        <Database className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            REST endpoint to receive logs from external systems
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">HTTP Proxy</CardTitle>
                        <Wifi className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            Built-in proxy to intercept LLM API traffic
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Kafka Stream</CardTitle>
                        <Settings className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            Connect to Kafka topics for network traffic logs
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* API Documentation */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        API Ingestion Endpoint
                    </CardTitle>
                    <CardDescription>Send LLM request logs to this endpoint from your systems</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
                            <p className="text-green-500">POST /api/shadow-ai/ingest</p>
                            <p className="text-muted-foreground mt-2">Headers:</p>
                            <p className="pl-4">x-api-key: your_api_key</p>
                            <p className="text-muted-foreground mt-2">Body:</p>
                            <pre className="pl-4 text-xs overflow-x-auto">{`{
  "sourceIp": "10.0.0.1",
  "targetUrl": "https://api.openai.com/v1/chat/completions",
  "prompt": "What is the capital of France?",
  "response": "The capital of France is Paris.",
  "model": "gpt-4"
}`}</pre>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Configured Sources */}
            <Card>
                <CardHeader>
                    <CardTitle>Configured Sources</CardTitle>
                    <CardDescription>Manage your active data collection sources</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataSourceManager initialSources={dataSources as any} />
                </CardContent>
            </Card>
        </div>
    );
}
