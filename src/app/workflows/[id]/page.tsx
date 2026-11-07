import { getWorkflow } from '@/lib/actions';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, FileJson, History, ShieldAlert, CheckCircle, ExternalLink, Database, Network, Globe, Code, MessageSquare, Cloud, HardDrive, Box, FileDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorkflowHistoryList } from '@/components/WorkflowHistoryList';
import { WorkflowVisualizer } from '@/components/WorkflowVisualizer';
import { ExportReportButton } from '@/components/ExportReportButton';
import { ExportInventoryButton } from '@/components/ExportInventoryButton';
import { WorkflowSecurityReport } from '@/components/WorkflowSecurityReport';
import Link from 'next/link';
import { ArrowLeft, Activity } from 'lucide-react';
import { ExecutionHistoryList } from '@/components/ExecutionHistoryList';
import { DownloadRawJSONButton } from '@/components/DownloadRawJSONButton';
import { cn } from '@/lib/utils';

interface ComponentItem {
    category: string;
    service: string;
    nodeName: string;
    nodeType: string;
    id: string;
    model?: string;
}

const categoryConfig: Record<string, { icon: string; color: string }> = {
    'AI / LLM': { icon: 'brain', color: 'text-purple-500' },
    'Database': { icon: 'database', color: 'text-blue-500' },
    'Communication': { icon: 'message', color: 'text-indigo-500' },
    'HTTP / API': { icon: 'globe', color: 'text-cyan-500' },
    'Cloud': { icon: 'cloud', color: 'text-orange-500' },
    'Code / Logic': { icon: 'code', color: 'text-yellow-500' },
    'File / Storage': { icon: 'storage', color: 'text-gray-500' },
    'Other': { icon: 'box', color: 'text-muted-foreground' },
};

function classifyNode(node: any): ComponentItem {
    const t = node.type.toLowerCase();

    // AI / LLM
    if (t.includes('openai') || t.includes('chatgpt')) return { category: 'AI / LLM', service: 'OpenAI', nodeName: node.name, nodeType: node.type, id: node.id, model: node.parameters?.model || node.parameters?.modelId };
    if (t.includes('anthropic') || t.includes('claude')) return { category: 'AI / LLM', service: 'Anthropic', nodeName: node.name, nodeType: node.type, id: node.id, model: node.parameters?.model || node.parameters?.modelName };
    if (t.includes('cohere')) return { category: 'AI / LLM', service: 'Cohere', nodeName: node.name, nodeType: node.type, id: node.id, model: node.parameters?.model };
    if (t.includes('googlepalm') || t.includes('vertexai') || t.includes('gemini')) return { category: 'AI / LLM', service: 'Google AI', nodeName: node.name, nodeType: node.type, id: node.id, model: node.parameters?.model || node.parameters?.modelName };
    if (t.includes('huggingface')) return { category: 'AI / LLM', service: 'HuggingFace', nodeName: node.name, nodeType: node.type, id: node.id, model: node.parameters?.model };
    if (t.includes('mistral')) return { category: 'AI / LLM', service: 'Mistral', nodeName: node.name, nodeType: node.type, id: node.id, model: node.parameters?.model };
    if (t.includes('ollama') || t.includes('localai')) return { category: 'AI / LLM', service: 'Local AI', nodeName: node.name, nodeType: node.type, id: node.id, model: node.parameters?.model };
    if (t.includes('pinecone') || t.includes('qdrant') || t.includes('weaviate') || t.includes('chroma')) return { category: 'AI / LLM', service: 'Vector DB', nodeName: node.name, nodeType: node.type, id: node.id };
    if (t.includes('agent') || t.includes('chain') || t.includes('langchain') || t.includes('lmchatmodel')) return { category: 'AI / LLM', service: 'AI Agent', nodeName: node.name, nodeType: node.type, id: node.id };
    // Database
    if (t.includes('postgres') || t.includes('mysql') || t.includes('mongo') || t.includes('redis') || t.includes('supabase') || t.includes('sqlite') || t.includes('mariadb') || t.includes('mssql')) return { category: 'Database', service: t.split('.').pop() || 'Database', nodeName: node.name, nodeType: node.type, id: node.id };
    // Communication
    if (t.includes('slack') || t.includes('discord') || t.includes('telegram') || t.includes('teams') || t.includes('whatsapp')) return { category: 'Communication', service: t.split('.').pop() || 'Messaging', nodeName: node.name, nodeType: node.type, id: node.id };
    if (t.includes('mail') || t.includes('smtp') || t.includes('imap') || t.includes('gmail') || t.includes('sendgrid')) return { category: 'Communication', service: 'Email', nodeName: node.name, nodeType: node.type, id: node.id };
    // HTTP / API
    if (t.includes('httprequest') || t.includes('http') || t.includes('graphql') || t.includes('rest') || t.includes('soap')) return { category: 'HTTP / API', service: 'HTTP Request', nodeName: node.name, nodeType: node.type, id: node.id };
    if (t.includes('webhook')) return { category: 'HTTP / API', service: 'Webhook', nodeName: node.name, nodeType: node.type, id: node.id };
    // Cloud
    if (t.includes('aws') || t.includes('s3') || t.includes('sqs') || t.includes('lambda') || t.includes('dynamodb')) return { category: 'Cloud', service: 'AWS', nodeName: node.name, nodeType: node.type, id: node.id };
    if (t.includes('gcs') || t.includes('googlecloud') || t.includes('bigquery') || t.includes('firestore')) return { category: 'Cloud', service: 'Google Cloud', nodeName: node.name, nodeType: node.type, id: node.id };
    if (t.includes('azure') || t.includes('cosmosdb')) return { category: 'Cloud', service: 'Azure', nodeName: node.name, nodeType: node.type, id: node.id };
    // File / Storage
    if (t.includes('readfile') || t.includes('writefile') || t.includes('file') || t.includes('ftp') || t.includes('sftp') || t.includes('csv') || t.includes('spreadsheet') || t.includes('googledrive') || t.includes('dropbox') || t.includes('onedrive')) return { category: 'File / Storage', service: 'File I/O', nodeName: node.name, nodeType: node.type, id: node.id };
    // Code / Logic
    if (t.includes('function') || t.includes('code') || t.includes('set') || t.includes('if') || t.includes('switch') || t.includes('merge') || t.includes('splitinbatches') || t.includes('noop') || t.includes('executeworkflow') || t.includes('start') || t.includes('manualTrigger') || t.includes('cron') || t.includes('schedule') || t.includes('interval') || t.includes('trigger')) return { category: 'Code / Logic', service: node.type.replace('n8n-nodes-base.', ''), nodeName: node.name, nodeType: node.type, id: node.id };
    // Other
    return { category: 'Other', service: node.type.replace('n8n-nodes-base.', ''), nodeName: node.name, nodeType: node.type, id: node.id };
}

function extractAllComponents(nodes: any[]): Record<string, ComponentItem[]> {
    const grouped: Record<string, ComponentItem[]> = {};
    nodes.forEach(n => {
        const item = classifyNode(n);
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    });
    return grouped;
}

const CategoryIcon = ({ category }: { category: string }) => {
    switch (category) {
        case 'AI / LLM': return <Network className="h-4 w-4 text-purple-500" />;
        case 'Database': return <Database className="h-4 w-4 text-blue-500" />;
        case 'Communication': return <MessageSquare className="h-4 w-4 text-indigo-500" />;
        case 'HTTP / API': return <Globe className="h-4 w-4 text-cyan-500" />;
        case 'Cloud': return <Cloud className="h-4 w-4 text-orange-500" />;
        case 'Code / Logic': return <Code className="h-4 w-4 text-yellow-500" />;
        case 'File / Storage': return <HardDrive className="h-4 w-4 text-gray-500" />;
        default: return <Box className="h-4 w-4 text-muted-foreground" />;
    }
};

export default async function WorkflowDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const workflow = await getWorkflow(id);
    const n8nBaseUrl = process.env.N8N_BASE_URL;

    if (!workflow) {
        notFound();
    }

    const issues = workflow.securityIssues ? JSON.parse(workflow.securityIssues) : [];
    const nodes = workflow.nodes ? JSON.parse(workflow.nodes) : [];
    const allComponents = extractAllComponents(nodes);
    const totalComponents = Object.values(allComponents).reduce((sum, arr) => sum + arr.length, 0);

    return (
        <div className="space-y-6">
            <div>
                <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
                    <Link href="/workflows">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Workflows
                    </Link>
                </Button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{workflow.name}</h1>
                        <p className="text-muted-foreground">ID: {workflow.id}</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-muted/50 font-normal">
                                {(workflow as any).environment?.name || 'Unknown Environment'}
                            </Badge>
                            <Badge variant={workflow.active ? 'default' : 'secondary'}>
                                {workflow.active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge
                                variant="outline"
                                className={cn(
                                    workflow.riskScore >= 70
                                        ? "border-red-500/30 text-red-600 bg-red-500/10"
                                        : workflow.riskScore >= 40
                                        ? "border-orange-500/30 text-orange-600 bg-orange-500/10"
                                        : workflow.riskScore > 0
                                        ? "border-yellow-500/30 text-yellow-600 bg-yellow-500/10"
                                        : "border-green-500/30 text-green-600 bg-green-500/10"
                                )}
                            >
                                Risk Score: {workflow.riskScore} {workflow.riskScore === 0 ? '(Safe)' : ''}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {workflow.owner && (
                                <Badge variant="secondary" className="font-normal text-xs bg-muted/30">
                                    <span className="opacity-70 mr-1">Owner:</span> {workflow.owner}
                                </Badge>
                            )}
                            {workflow.published && (
                                <Badge variant="outline" className="font-normal text-xs border-blue-200 text-blue-600 bg-blue-500/10">
                                    Published
                                </Badge>
                            )}
                            {workflow.n8nCreatedAt && (
                                <span className="text-xs">
                                    Created: {new Date(workflow.n8nCreatedAt).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="model-inventory">Model & API Inventory</TabsTrigger>
                    <TabsTrigger value="executions" className="gap-2">
                        <Activity className="h-4 w-4" /> Executions
                    </TabsTrigger>
                    <TabsTrigger value="security">Security Report</TabsTrigger>
                    <TabsTrigger value="history">Version History</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <Card className="border-none bg-transparent shadow-none">
                        <WorkflowVisualizer
                            workflow={workflow as any}
                            nodes={nodes}
                            connections={workflow.connections ? JSON.parse(workflow.connections) : {}}
                            issues={issues}
                        />
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>Raw Definition</CardTitle>
                            <DownloadRawJSONButton
                                data={nodes}
                                filename={`workflow-${workflow.id}-raw.json`}
                            />
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/50">
                                <pre className="text-xs">{JSON.stringify(nodes, null, 2)}</pre>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="model-inventory" className="space-y-4">
                    {totalComponents > 0 ? (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {Object.entries(allComponents).map(([cat, items]) => (
                                    <Card key={cat} className="border-none bg-muted/30">
                                        <CardContent className="p-3 flex items-center gap-2">
                                            <CategoryIcon category={cat} />
                                            <div>
                                                <p className="text-xs text-muted-foreground">{cat}</p>
                                                <p className="text-lg font-bold">{items.length}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            {Object.entries(allComponents).map(([cat, items]) => (
                                <Card key={cat}>
                                    <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <CategoryIcon category={cat} />
                                            {cat}
                                            <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
                                        </CardTitle>
                                        <ExportInventoryButton items={items.map(i => ({
                                            ...i,
                                            workflowName: workflow.name,
                                            workflowId: workflow.id,
                                            environment: (workflow as any).environment?.name || 'Unknown'
                                        }))} />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {items.map((m, i) => (
                                                <div key={i} className="flex flex-col p-3 border rounded-md bg-muted/20 hover:bg-muted/40 transition-colors">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-semibold text-sm">{m.service}</span>
                                                        {m.model && (
                                                            <Badge variant="secondary" className="text-[10px] font-mono bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 px-1 py-0 h-4">
                                                                {m.model}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground mt-1 truncate" title={m.nodeName}>Node: {m.nodeName}</span>
                                                    <span className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate" title={m.nodeType}>{m.nodeType}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </>
                    ) : (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>No Components Detected</AlertTitle>
                            <AlertDescription>No components were found in this workflow definition.</AlertDescription>
                        </Alert>
                    )}
                </TabsContent>

                <TabsContent value="executions" className="space-y-4">
                    <ExecutionHistoryList workflowId={workflow.id} />
                </TabsContent>

                <TabsContent value="security" className="space-y-4">
                    <div className="flex justify-end">
                        <ExportReportButton workflow={workflow} n8nBaseUrl={n8nBaseUrl} />
                    </div>

                    {issues.length === 0 ? (
                        <Alert className="bg-green-500/10 text-green-600 border-green-500/20">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle>No Issues Found</AlertTitle>
                            <AlertDescription>This workflow passed all security checks.</AlertDescription>
                        </Alert>
                    ) : (
                        <WorkflowSecurityReport
                            workflowId={workflow.id}
                            initialIssues={issues}
                            n8nBaseUrl={n8nBaseUrl}
                        />
                    )}
                </TabsContent>

                <TabsContent value="history" className="space-y-4">
                    <WorkflowHistoryList history={workflow.history} currentNodes={nodes} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
