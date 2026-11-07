export interface WorkflowAttackNode {
    name: string;
    type: string;
}

export interface WorkflowConnectionLink {
    source: string;
    target: string;
}

export interface WorkflowSecurityIssueInput {
    nodeName?: string;
    severity?: string;
    type?: string;
}

export interface WorkflowAttackPathAnalysis {
    hasAttackPath: boolean;
    entryKind: 'external' | 'workflow-root';
    entryNodeNames: string[];
    attackEntryNodeNames: string[];
    reachableNodeNames: string[];
    vulnerableNodeNames: string[];
    attackPathNodeNames: string[];
    attackLinks: WorkflowConnectionLink[];
    maxDepth: number;
}

const PASSIVE_TRIGGER_PATTERNS = [
    'manualtrigger',
    'scheduletrigger',
    'intervaltrigger',
    'cron',
    'workflowtrigger',
    'executeworkflowtrigger',
    'errortrigger',
];

const EXTERNAL_ENTRY_PATTERNS = [
    'webhook',
    'formtrigger',
    'chattrigger',
    'emailreadimap',
    'imap',
    'slacktrigger',
    'telegramtrigger',
    'discordtrigger',
    'teamstrigger',
    'mqtttrigger',
    'kafkatrigger',
    'rabbitmqtrigger',
    'websocket',
];

export function isExternalWorkflowEntry(type: string): boolean {
    const normalizedType = type.toLowerCase();
    if (PASSIVE_TRIGGER_PATTERNS.some((pattern) => normalizedType.includes(pattern))) return false;
    if (EXTERNAL_ENTRY_PATTERNS.some((pattern) => normalizedType.includes(pattern))) return true;

    // Unknown trigger integrations generally ingest events from outside the workflow.
    return normalizedType.includes('trigger');
}

function collectTargets(value: unknown, targets: Set<string>) {
    if (Array.isArray(value)) {
        value.forEach((item) => collectTargets(item, targets));
        return;
    }

    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record.node === 'string') {
        targets.add(record.node);
        return;
    }

    Object.values(record).forEach((item) => collectTargets(item, targets));
}

export function extractWorkflowLinks(connections: unknown): WorkflowConnectionLink[] {
    if (!connections || typeof connections !== 'object') return [];

    const links: WorkflowConnectionLink[] = [];
    const seen = new Set<string>();

    Object.entries(connections as Record<string, unknown>).forEach(([source, outputs]) => {
        const targets = new Set<string>();
        collectTargets(outputs, targets);
        targets.forEach((target) => {
            const key = `${source}\u0000${target}`;
            if (seen.has(key)) return;
            seen.add(key);
            links.push({ source, target });
        });
    });

    return links;
}

export function analyzeWorkflowAttackPaths(
    nodes: WorkflowAttackNode[],
    connections: unknown,
    issues: WorkflowSecurityIssueInput[] = [],
): WorkflowAttackPathAnalysis {
    const nodeNames = new Set(nodes.map((node) => node.name));
    const links = extractWorkflowLinks(connections).filter(
        (link) => nodeNames.has(link.source) && nodeNames.has(link.target),
    );
    const incoming = new Map<string, number>(nodes.map((node) => [node.name, 0]));
    const adjacency = new Map<string, string[]>(nodes.map((node) => [node.name, []]));
    const reverseAdjacency = new Map<string, string[]>(nodes.map((node) => [node.name, []]));

    links.forEach(({ source, target }) => {
        incoming.set(target, (incoming.get(target) || 0) + 1);
        adjacency.get(source)?.push(target);
        reverseAdjacency.get(target)?.push(source);
    });

    const externalEntries = nodes
        .filter((node) => isExternalWorkflowEntry(node.type))
        .map((node) => node.name);
    const workflowRoots = nodes
        .filter((node) => (incoming.get(node.name) || 0) === 0)
        .map((node) => node.name);
    const entryKind = externalEntries.length > 0 ? 'external' : 'workflow-root';
    const entryNodeNames = externalEntries.length > 0 ? externalEntries : workflowRoots;

    const reachable = new Set<string>();
    const depth = new Map<string, number>();
    const queue = entryNodeNames.map((name) => ({ name, depth: 0 }));

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;
        const knownDepth = depth.get(current.name);
        if (knownDepth !== undefined && knownDepth <= current.depth) continue;

        reachable.add(current.name);
        depth.set(current.name, current.depth);
        (adjacency.get(current.name) || []).forEach((target) => {
            queue.push({ name: target, depth: current.depth + 1 });
        });
    }

    const vulnerableNodeNames = Array.from(
        new Set(
            issues
                .filter((issue) => typeof issue?.nodeName === 'string' && nodeNames.has(issue.nodeName))
                .map((issue) => issue.nodeName as string),
        ),
    );

    // If there are no detected vulnerabilities, there is NO attack path and NO attack entry
    if (vulnerableNodeNames.length === 0) {
        return {
            hasAttackPath: false,
            entryKind,
            entryNodeNames,
            attackEntryNodeNames: [],
            reachableNodeNames: Array.from(reachable),
            vulnerableNodeNames: [],
            attackPathNodeNames: [],
            attackLinks: [],
            maxDepth: Math.max(0, ...depth.values()),
        };
    }

    // Traverse backward from vulnerable nodes to find all upstream nodes that can reach any vulnerability
    const canReachVuln = new Set<string>();
    const revQueue = [...vulnerableNodeNames];
    revQueue.forEach((name) => canReachVuln.add(name));

    while (revQueue.length > 0) {
        const current = revQueue.shift();
        if (!current) break;
        const preds = reverseAdjacency.get(current) || [];
        for (const pred of preds) {
            if (!canReachVuln.has(pred)) {
                canReachVuln.add(pred);
                revQueue.push(pred);
            }
        }
    }

    // Attack entries are workflow triggers/entries that can reach at least one vulnerable node
    const attackEntryNodeNames = entryNodeNames.filter(
        (name) => canReachVuln.has(name) && reachable.has(name),
    );

    const hasAttackPath = attackEntryNodeNames.length > 0;

    if (!hasAttackPath) {
        return {
            hasAttackPath: false,
            entryKind,
            entryNodeNames,
            attackEntryNodeNames: [],
            reachableNodeNames: Array.from(reachable),
            vulnerableNodeNames,
            attackPathNodeNames: [],
            attackLinks: [],
            maxDepth: Math.max(0, ...depth.values()),
        };
    }

    // Forward traverse from attack entries strictly through nodes that can reach a vulnerability
    const attackPathNodes = new Set<string>();
    const fwdQueue = [...attackEntryNodeNames];
    fwdQueue.forEach((name) => attackPathNodes.add(name));

    while (fwdQueue.length > 0) {
        const current = fwdQueue.shift();
        if (!current) break;
        const succs = adjacency.get(current) || [];
        for (const succ of succs) {
            if (canReachVuln.has(succ) && !attackPathNodes.has(succ)) {
                attackPathNodes.add(succ);
                fwdQueue.push(succ);
            }
        }
    }

    const attackLinks = links.filter(
        ({ source, target }) => attackPathNodes.has(source) && attackPathNodes.has(target),
    );

    return {
        hasAttackPath: true,
        entryKind,
        entryNodeNames,
        attackEntryNodeNames,
        reachableNodeNames: Array.from(reachable),
        vulnerableNodeNames,
        attackPathNodeNames: Array.from(attackPathNodes),
        attackLinks,
        maxDepth: Math.max(0, ...depth.values()),
    };
}
