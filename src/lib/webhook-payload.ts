export interface ExtractedWebhookParams {
    bodyParams: string[];
    queryParams: string[];
    headerParams: string[];
    hasExplicitParams: boolean;
    sampleBody: Record<string, any>;
    sampleQuery: Record<string, any>;
    sampleHeaders: Record<string, string>;
    sourceDetails: Array<{ name: string; type: 'body' | 'query' | 'header' | 'form_field'; nodeName?: string }>;
}

export interface GeneratedWebhookPayloads {
    method: string;
    url: string;
    host: string;
    path: string;
    rawHttpRequest: string;
    curlCommand: string;
    rawJsonBody: string;
    params: ExtractedWebhookParams;
    promptfooSnippet: string;
    promptmapYaml: string;
    pyritScript: string;
}

function getSampleValue(paramName: string): any {
    const lower = paramName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lower.includes('url') || lower.includes('link') || lower.includes('site') || lower.includes('domain')) {
        return 'https://example.com';
    }
    if (lower.includes('host') || lower.includes('ip') || lower.includes('addr')) {
        return '127.0.0.1';
    }
    if (lower.includes('email') || lower.includes('mail')) {
        return 'user@example.com';
    }
    if (lower.includes('user') || lower.includes('login') || lower.includes('account')) {
        return 'admin';
    }
    if (lower.includes('pass') || lower.includes('secret') || lower.includes('token') || lower.includes('key')) {
        return 'test-secret-value';
    }
    if (lower.includes('file') || lower.includes('path') || lower.includes('dir')) {
        return '/etc/passwd';
    }
    if (lower.includes('sql') || lower.includes('query')) {
        return 'SELECT * FROM users';
    }
    if (lower.includes('cmd') || lower.includes('command') || lower.includes('exec') || lower.includes('sh')) {
        return 'whoami';
    }
    if (lower.includes('name')) {
        return 'John Doe';
    }
    if (lower.includes('prompt') || lower.includes('message') || lower.includes('text') || lower.includes('input') || lower.includes('content')) {
        return 'Test payload content';
    }
    if (lower.includes('data')) {
        return 'test_data';
    }
    if (lower.includes('port')) {
        return 8080;
    }
    if (lower.includes('num') || lower.includes('count') || lower.includes('age') || lower.includes('limit')) {
        return 10;
    }
    return `test_${paramName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

/**
 * Traverses workflow connections starting from trigger node to find all downstream connected nodes.
 */
function getDownstreamConnectedNodes(nodes: any[], connections: any, triggerNodeName: string): any[] {
    if (!connections || typeof connections !== 'object' || Object.keys(connections).length === 0) {
        return nodes;
    }

    const visited = new Set<string>([triggerNodeName]);
    const queue = [triggerNodeName];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const nodeConns = connections[current];
        if (!nodeConns) continue;

        for (const connType of Object.keys(nodeConns)) {
            for (const group of nodeConns[connType] || []) {
                for (const target of group || []) {
                    if (target?.node && !visited.has(target.node)) {
                        visited.add(target.node);
                        queue.push(target.node);
                    }
                }
            }
        }
    }

    // Filter nodes to only those reachable from trigger (or all if traversal found only the trigger)
    if (visited.size > 1) {
        return nodes.filter(n => visited.has(n.name));
    }
    return nodes;
}

/**
 * Extracts parameters expected by a webhook based on:
 * 1. FormTrigger form fields
 * 2. ChatTrigger expectations
 * 3. Expressions in downstream nodes ($json.body.xxx, $json.query.xxx, etc.)
 */
export function extractWebhookExpectedParams(
    workflowNodesInput: any[] | string | undefined,
    workflowConnectionsInput: any | string | undefined,
    triggerNodeName: string,
    endpointType?: string
): ExtractedWebhookParams {
    let nodes: any[] = [];
    let connections: any = {};

    if (Array.isArray(workflowNodesInput)) {
        nodes = workflowNodesInput;
    } else if (typeof workflowNodesInput === 'string') {
        try { nodes = JSON.parse(workflowNodesInput); } catch { nodes = []; }
    }

    if (workflowConnectionsInput && typeof workflowConnectionsInput === 'object') {
        connections = workflowConnectionsInput;
    } else if (typeof workflowConnectionsInput === 'string') {
        try { connections = JSON.parse(workflowConnectionsInput); } catch { connections = {}; }
    }

    const triggerNode = nodes.find(n => n.name === triggerNodeName) || {};
    const nodeType = triggerNode.type || endpointType || '';

    const bodyParams = new Set<string>();
    const queryParams = new Set<string>();
    const headerParams = new Set<string>();
    const sourceDetails: ExtractedWebhookParams['sourceDetails'] = [];

    // Case 1: Form Trigger Node
    if (nodeType === 'n8n-nodes-base.formTrigger' || endpointType === 'form') {
        const fields = triggerNode.parameters?.formFields?.values || [];
        for (const field of fields) {
            if (field?.fieldLabel) {
                bodyParams.add(field.fieldLabel);
                sourceDetails.push({ name: field.fieldLabel, type: 'form_field', nodeName: triggerNode.name });
            }
        }
    }

    // Case 2: Chat Trigger Node
    if (nodeType === 'n8n-nodes-base.chatTrigger' || endpointType === 'chat') {
        bodyParams.add('chatInput');
        sourceDetails.push({ name: 'chatInput', type: 'body', nodeName: triggerNode.name });
    }

    // Case 3: Downstream node expressions
    const relevantNodes = getDownstreamConnectedNodes(nodes, connections, triggerNodeName);

    for (const node of relevantNodes) {
        if (node.name === triggerNodeName) continue; // Skip trigger node itself for expressions

        const nodeStr = JSON.stringify(node.parameters || {});

        // 1. $json.body.xxx or $json.body['xxx'] or $json.body["xxx"]
        const bodyDotRegex = /\$json(?:\?\.|\.)body(?:\?\.|\.)([a-zA-Z0-9_$-]+)/g;
        const bodyBracketRegex = /\$json(?:\?\.|\.)body\[['"]([^'"]+)['"]\]/g;

        let m: RegExpExecArray | null;
        while ((m = bodyDotRegex.exec(nodeStr)) !== null) {
            const param = m[1];
            if (!bodyParams.has(param)) {
                bodyParams.add(param);
                sourceDetails.push({ name: param, type: 'body', nodeName: node.name });
            }
        }
        while ((m = bodyBracketRegex.exec(nodeStr)) !== null) {
            const param = m[1];
            if (!bodyParams.has(param)) {
                bodyParams.add(param);
                sourceDetails.push({ name: param, type: 'body', nodeName: node.name });
            }
        }

        // 2. $json.query.xxx or $json.query['xxx']
        const queryDotRegex = /\$json(?:\?\.|\.)query(?:\?\.|\.)([a-zA-Z0-9_$-]+)/g;
        const queryBracketRegex = /\$json(?:\?\.|\.)query\[['"]([^'"]+)['"]\]/g;
        while ((m = queryDotRegex.exec(nodeStr)) !== null) {
            const param = m[1];
            if (!queryParams.has(param)) {
                queryParams.add(param);
                sourceDetails.push({ name: param, type: 'query', nodeName: node.name });
            }
        }
        while ((m = queryBracketRegex.exec(nodeStr)) !== null) {
            const param = m[1];
            if (!queryParams.has(param)) {
                queryParams.add(param);
                sourceDetails.push({ name: param, type: 'query', nodeName: node.name });
            }
        }

        // 3. $json.headers.xxx
        const headerDotRegex = /\$json(?:\?\.|\.)headers?(?:\?\.|\.)([a-zA-Z0-9_$-]+)/g;
        while ((m = headerDotRegex.exec(nodeStr)) !== null) {
            const param = m[1];
            if (!headerParams.has(param)) {
                headerParams.add(param);
                sourceDetails.push({ name: param, type: 'header', nodeName: node.name });
            }
        }

        // 4. Trigger name explicit reference: $('Webhook').item.json.body.xxx
        const escapedTriggerName = triggerNodeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const namedNodeRegex = new RegExp(`\\$\\(['"]${escapedTriggerName}['"]\\)\\.(?:item\\.)?json(?:\\?\\.|\\.)body(?:\\?\\.|\\.)([a-zA-Z0-9_$-]+)`, 'g');
        while ((m = namedNodeRegex.exec(nodeStr)) !== null) {
            const param = m[1];
            if (!bodyParams.has(param)) {
                bodyParams.add(param);
                sourceDetails.push({ name: param, type: 'body', nodeName: node.name });
            }
        }

        // 5. Direct $json['Property Name']
        const directBracketRegex = /\$json\[['"]([^'"]+)['"]\]/g;
        const reservedKeywords = ['body', 'query', 'headers', 'header', 'params', 'execution', 'workflow', 'item', 'pairedItem', 'stdout', 'stderr', 'exitCode'];
        while ((m = directBracketRegex.exec(nodeStr)) !== null) {
            const param = m[1];
            if (!reservedKeywords.includes(param) && !bodyParams.has(param)) {
                bodyParams.add(param);
                sourceDetails.push({ name: param, type: 'body', nodeName: node.name });
            }
        }
    }

    const hasExplicitParams = bodyParams.size > 0 || queryParams.size > 0 || headerParams.size > 0;

    // Generate sample body
    const sampleBody: Record<string, any> = {};
    if (bodyParams.size > 0) {
        for (const p of bodyParams) {
            sampleBody[p] = getSampleValue(p);
        }
    } else {
        // Fallback default
        sampleBody['prompt'] = 'Insert your prompt or test payload here...';
    }

    // Generate sample query
    const sampleQuery: Record<string, any> = {};
    for (const q of queryParams) {
        sampleQuery[q] = getSampleValue(q);
    }

    // Generate sample headers
    const sampleHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    for (const h of headerParams) {
        sampleHeaders[h] = 'test-header-value';
    }

    return {
        bodyParams: Array.from(bodyParams),
        queryParams: Array.from(queryParams),
        headerParams: Array.from(headerParams),
        hasExplicitParams,
        sampleBody,
        sampleQuery,
        sampleHeaders,
        sourceDetails
    };
}

/**
 * Builds all request formats: Raw HTTP Request, cURL command, JSON body, Promptfoo, Promptmap, PyRIT.
 */
export function generateWebhookPayloads(webhook: {
    id: string;
    method?: string;
    nodeName: string;
    prodUrl?: string;
    testUrl?: string;
    type?: string;
    workflow?: {
        name?: string;
        nodes?: string;
        connections?: string;
    };
}): GeneratedWebhookPayloads {
    const rawUrl = webhook.prodUrl || webhook.testUrl || 'http://localhost:5678/webhook/sample';
    const method = (webhook.method || 'POST').toUpperCase();

    let host = 'localhost:5678';
    let path = '/webhook';
    try {
        const parsed = new URL(rawUrl);
        host = parsed.host;
        path = parsed.pathname;
    } catch {
        // keep defaults
    }

    const params = extractWebhookExpectedParams(
        webhook.workflow?.nodes,
        webhook.workflow?.connections,
        webhook.nodeName,
        webhook.type
    );

    // Build URL with query parameters if GET or query params exist
    let urlWithQuery = rawUrl;
    let pathWithQuery = path;
    const queryEntries = Object.entries(params.sampleQuery);
    if (queryEntries.length > 0) {
        const qs = queryEntries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
        urlWithQuery += (rawUrl.includes('?') ? '&' : '?') + qs;
        pathWithQuery += (path.includes('?') ? '&' : '?') + qs;
    }

    const rawJsonBody = JSON.stringify(params.sampleBody, null, 2);

    // 1. Raw HTTP Request (RFC 9112 format)
    let rawHttpRequest = '';
    if (method === 'GET') {
        const headerLines = [`GET ${pathWithQuery} HTTP/1.1`, `Host: ${host}`];
        for (const [k, v] of Object.entries(params.sampleHeaders)) {
            if (k.toLowerCase() !== 'content-type') {
                headerLines.push(`${k}: ${v}`);
            }
        }
        rawHttpRequest = headerLines.join('\n');
    } else {
        const headerLines = [`${method} ${pathWithQuery} HTTP/1.1`, `Host: ${host}`];
        for (const [k, v] of Object.entries(params.sampleHeaders)) {
            headerLines.push(`${k}: ${v}`);
        }
        rawHttpRequest = `${headerLines.join('\n')}\n\n${rawJsonBody}`;
    }

    // 2. cURL command
    let curlCommand = '';
    if (method === 'GET') {
        curlCommand = `curl -X GET "${urlWithQuery}" \\\n  -H "Accept: application/json"`;
    } else {
        curlCommand = `curl -X ${method} "${urlWithQuery}" \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json" \\\n  -d '${JSON.stringify(params.sampleBody, null, 2)}'`;
    }

    // 3. Promptfoo Snippet
    // Map body parameters so {{prompt}} is injected into the expected input field(s)
    const promptfooBody: Record<string, string> = {};
    if (params.bodyParams.length > 0) {
        for (const p of params.bodyParams) {
            promptfooBody[p] = '{{prompt}}';
        }
    } else {
        promptfooBody['prompt'] = '{{prompt}}';
        promptfooBody['text'] = '{{prompt}}';
        promptfooBody['message'] = '{{prompt}}';
        promptfooBody['input'] = '{{prompt}}';
    }

    const promptfooSnippet = `- id: http
  label: "Webhook: ${webhook.nodeName} (${webhook.workflow?.name || 'Unknown'})"
  config:
    url: "${urlWithQuery}"
    method: ${method}
    headers:
      Content-Type: application/json
    body:
${Object.entries(promptfooBody).map(([k, v]) => `      ${k.includes(' ') || k.includes('-') ? `"${k}"` : k}: "${v}"`).join('\n')}
    responseParser: "json.output || json.response || json.message || json.result || json.data || JSON.stringify(json)"`;

    // 4. Promptmap YAML
    const promptmapYaml = `name: ${webhook.nodeName} Endpoint
method: ${method}
url: ${urlWithQuery}
headers:
  Content-Type: application/json
json:
${Object.keys(promptfooBody).map(k => `  ${k.includes(' ') || k.includes('-') ? `"${k}"` : k}: "{PAYLOAD_POSITION}"`).join('\n')}
answer_focus_hint: '"{ANSWER_POSITION}"'
`;

    // 5. PyRIT Script
    const primaryKey = params.bodyParams[0] || 'prompt';
    const pyritScript = `import asyncio
import os
from pyrit.executor.attack import (
    AttackConverterConfig,
    PromptSendingAttack,
    ConsoleAttackResultPrinter,
)
from pyrit.prompt_converter import JsonStringConverter
from pyrit.prompt_normalizer import PromptConverterConfiguration
from pyrit.prompt_target import HTTPTarget, get_http_target_json_response_callback_function
from pyrit.setup import IN_MEMORY, initialize_pyrit_async

async def main():
    await initialize_pyrit_async(memory_db_type=IN_MEMORY)

    url = "${urlWithQuery}"
    raw_http_request = f"""${rawHttpRequest.replace(new RegExp(getSampleValue(primaryKey), 'g'), '{{PROMPT}}')}"""
    
    # Callback function parsing response
    parsing_function = get_http_target_json_response_callback_function(key="output")
    
    http_prompt_target = HTTPTarget(http_request=raw_http_request, callback_function=parsing_function)
    converters = PromptConverterConfiguration.from_converters(converters=[JsonStringConverter()])
    converter_config = AttackConverterConfig(request_converters=converters)
    
    attack = PromptSendingAttack(objective_target=http_prompt_target, attack_converter_config=converter_config)
    objective = "Execute security test prompt"
    result = await attack.execute_async(objective=objective)
    await ConsoleAttackResultPrinter().print_conversation_async(result=result)

if __name__ == "__main__":
    asyncio.run(main())
`;

    return {
        method,
        url: urlWithQuery,
        host,
        path: pathWithQuery,
        rawHttpRequest,
        curlCommand,
        rawJsonBody,
        params,
        promptfooSnippet,
        promptmapYaml,
        pyritScript
    };
}
