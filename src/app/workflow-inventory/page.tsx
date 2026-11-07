import { getWorkflows } from '@/lib/actions';
import { Card, CardContent } from '@/components/ui/card';
import { Database, Activity, BrainCircuit, ExternalLink, Info, ShieldCheck, TriangleAlert } from 'lucide-react';
import { InventoryCategoryGroup, ComponentItem } from '@/components/InventoryCategoryGroup';
import { ExportInventoryButton } from '@/components/ExportInventoryButton';
import { CISCO_LEADERBOARD_URL, getCiscoLeaderboard, matchCiscoModel } from '@/lib/cisco-leaderboard';

interface WorkflowNode {
    name: string;
    type: string;
    parameters?: Record<string, unknown>;
}

function readModelValue(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed && !trimmed.startsWith('=') ? trimmed : undefined;
    }

    if (value && typeof value === 'object') {
        const objectValue = value as Record<string, unknown>;
        return readModelValue(objectValue.value)
            || readModelValue(objectValue.model)
            || readModelValue(objectValue.id);
    }

    return undefined;
}

function extractModelName(parameters: Record<string, unknown> = {}): string | undefined {
    const options = parameters.options && typeof parameters.options === 'object'
        ? parameters.options as Record<string, unknown>
        : {};

    return readModelValue(parameters.model)
        || readModelValue(parameters.modelName)
        || readModelValue(parameters.modelId)
        || readModelValue(options.model)
        || readModelValue(options.modelName);
}

function parseWorkflowNodes(value: string): WorkflowNode[] {
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((node): node is WorkflowNode => (
            Boolean(node)
            && typeof node === 'object'
            && typeof (node as WorkflowNode).name === 'string'
            && typeof (node as WorkflowNode).type === 'string'
        ));
    } catch {
        return [];
    }
}

function classifyNode(node: WorkflowNode): Partial<ComponentItem> {
    const t = node.type.toLowerCase();
    const model = extractModelName(node.parameters);
    if (t.includes('openai') || t.includes('chatgpt')) return { category: 'AI / LLM', service: 'OpenAI', model };
    if (t.includes('anthropic') || t.includes('claude')) return { category: 'AI / LLM', service: 'Anthropic', model };
    if (t.includes('cohere')) return { category: 'AI / LLM', service: 'Cohere', model };
    if (t.includes('googlepalm') || t.includes('vertexai') || t.includes('gemini')) return { category: 'AI / LLM', service: 'Google AI', model };
    if (t.includes('huggingface')) return { category: 'AI / LLM', service: 'HuggingFace', model };
    if (t.includes('mistral')) return { category: 'AI / LLM', service: 'Mistral', model };
    if (t.includes('ollama') || t.includes('localai')) return { category: 'AI / LLM', service: 'Local AI', model };
    if (t.includes('pinecone') || t.includes('qdrant') || t.includes('weaviate') || t.includes('chroma')) return { category: 'AI / LLM', service: 'Vector DB' };
    if (t.includes('agent') || t.includes('chain') || t.includes('langchain') || t.includes('lmchatmodel')) return { category: 'AI / LLM', service: 'AI Agent' };
    if (t.includes('postgres') || t.includes('mysql') || t.includes('mongo') || t.includes('redis') || t.includes('supabase') || t.includes('sqlite') || t.includes('mariadb') || t.includes('mssql')) return { category: 'Database', service: t.split('.').pop() || 'Database' };
    if (t.includes('slack') || t.includes('discord') || t.includes('telegram') || t.includes('teams') || t.includes('whatsapp')) return { category: 'Communication', service: t.split('.').pop() || 'Messaging' };
    if (t.includes('mail') || t.includes('smtp') || t.includes('imap') || t.includes('gmail') || t.includes('sendgrid')) return { category: 'Communication', service: 'Email' };
    if (t.includes('httprequest') || t.includes('http') || t.includes('graphql') || t.includes('rest') || t.includes('soap')) return { category: 'HTTP / API', service: 'HTTP Request' };
    if (t.includes('webhook')) return { category: 'HTTP / API', service: 'Webhook' };
    if (t.includes('aws') || t.includes('s3') || t.includes('sqs') || t.includes('lambda') || t.includes('dynamodb')) return { category: 'Cloud', service: 'AWS' };
    if (t.includes('gcs') || t.includes('googlecloud') || t.includes('bigquery') || t.includes('firestore')) return { category: 'Cloud', service: 'Google Cloud' };
    if (t.includes('azure') || t.includes('cosmosdb')) return { category: 'Cloud', service: 'Azure' };
    if (t.includes('readfile') || t.includes('writefile') || t.includes('file') || t.includes('ftp') || t.includes('sftp') || t.includes('csv') || t.includes('spreadsheet') || t.includes('googledrive') || t.includes('dropbox') || t.includes('onedrive')) return { category: 'File / Storage', service: 'File I/O' };
    if (t.includes('function') || t.includes('code') || t.includes('set') || t.includes('if') || t.includes('switch') || t.includes('merge') || t.includes('splitinbatches') || t.includes('noop') || t.includes('executeworkflow') || t.includes('start') || t.includes('manualTrigger') || t.includes('cron') || t.includes('schedule') || t.includes('interval') || t.includes('trigger')) return { category: 'Code / Logic', service: node.type.replace('n8n-nodes-base.', '') };
    return { category: 'Other', service: node.type.replace('n8n-nodes-base.', '') };
}

export default async function WorkflowInventoryPage() {
    const [workflows, leaderboard] = await Promise.all([
        getWorkflows(),
        getCiscoLeaderboard(),
    ]);
    const leaderboardAvailable = leaderboard.length > 0;

    const allItems: ComponentItem[] = [];

    workflows.forEach((wf) => {
        const nodes = parseWorkflowNodes(wf.nodes);
        nodes.forEach((node) => {
            const classified = classifyNode(node);
            const model = classified.model;
            allItems.push({
                category: classified.category || 'Other',
                service: classified.service || 'Unknown',
                nodeName: node.name,
                nodeType: node.type,
                workflowName: wf.name,
                workflowId: wf.id,
                environment: wf.environment?.name || 'Unknown',
                model,
                modelScore: model ? matchCiscoModel(model, leaderboard) : null,
                leaderboardAvailable,
                workflowRiskScore: wf.riskScore,
                workflowActive: wf.active,
            });
        });
    });

    const grouped: Record<string, ComponentItem[]> = {};
    allItems.forEach(item => {
        if (!grouped[item.category]) grouped[item.category] = [];
        grouped[item.category].push(item);
    });

    const uniqueServices = new Set(allItems.map(i => i.service));
    const aiItems = allItems.filter((item) => item.category === 'AI / LLM' && item.model);
    const uniqueModels = new Set(aiItems.map((item) => item.model));
    const rankedModels = new Set(aiItems.filter((item) => item.modelScore).map((item) => item.model));
    const highRiskWorkflows = workflows.filter((workflow) => workflow.riskScore >= 40).length;
    const orderedGroups = Object.entries(grouped).sort(([categoryA], [categoryB]) => {
        if (categoryA === 'AI / LLM') return -1;
        if (categoryB === 'AI / LLM') return 1;
        return categoryA.localeCompare(categoryB);
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Activity className="h-8 w-8 text-primary" />
                        Workflow Inventory
                    </h1>
                    <p className="text-muted-foreground">
                        Aggregated view of all components, services, and integrations detected across your n8n workflows.
                    </p>
                </div>
                {allItems.length > 0 && (
                    <ExportInventoryButton items={allItems} />
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
                <Card className="bg-gradient-to-br from-primary/10 to-transparent border-none">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Total Components</p>
                        <p className="text-3xl font-bold">{allItems.length}</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-none">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Unique Services</p>
                        <p className="text-3xl font-bold">{uniqueServices.size}</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-none">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">Workflows Analyzed</p>
                        <p className="text-3xl font-bold">{workflows.length}</p>
                    </CardContent>
                </Card>
                <Card className="border-none bg-gradient-to-br from-fuchsia-500/10 to-transparent">
                    <CardContent className="p-4">
                        <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><BrainCircuit className="h-3.5 w-3.5" /> Detected Models</p>
                        <p className="text-3xl font-bold">{uniqueModels.size}</p>
                    </CardContent>
                </Card>
                <Card className="border-none bg-gradient-to-br from-emerald-500/10 to-transparent">
                    <CardContent className="p-4">
                        <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Cisco Ranked</p>
                        <p className="text-3xl font-bold">{rankedModels.size}</p>
                    </CardContent>
                </Card>
                <Card className="border-none bg-gradient-to-br from-red-500/10 to-transparent">
                    <CardContent className="p-4">
                        <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><TriangleAlert className="h-3.5 w-3.5" /> High-Risk Workflows</p>
                        <p className="text-3xl font-bold">{highRiskWorkflows}</p>
                    </CardContent>
                </Card>
            </div>

            {uniqueModels.size > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                        <p>
                            Cisco scores benchmark base-model resistance to single-turn and multi-turn attacks. They do not include your deployment guardrails or configuration.
                        </p>
                    </div>
                    <a href={CISCO_LEADERBOARD_URL} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline">
                        View leaderboard <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </div>
            )}

            <div className="space-y-6">
                {orderedGroups.map(([cat, items]) => (
                    <InventoryCategoryGroup key={cat} category={cat} items={items} />
                ))}
            </div>

            {allItems.length === 0 && (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No workflow components found.</p>
                    <p className="text-sm mt-2 opacity-80">Sync your n8n workflows first to populate this inventory.</p>
                </div>
            )}
        </div>
    );
}
