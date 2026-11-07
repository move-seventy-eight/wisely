'use client';

import { useMemo } from 'react';
import {
    Background,
    Controls,
    MarkerType,
    MiniMap,
    Panel,
    Position,
    ReactFlow,
    useEdgesState,
    useNodesState,
    type Edge,
    type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { N8nNode, N8nWorkflow } from '@/lib/types';
import {
    Box,
    CheckCircle,
    Clock,
    Code,
    Crosshair,
    Database,
    Edit3,
    FileText,
    GitFork,
    Globe,
    Mail,
    MessageSquare,
    Route,
    ShieldCheck,
    Split,
    Terminal,
    UploadCloud,
    Webhook,
    Zap,
} from 'lucide-react';
import {
    analyzeWorkflowAttackPaths,
    extractWorkflowLinks,
} from '@/lib/workflow-attack-paths';

const ATTACKER_NODE_ID = '__wisely_external_attacker__';

interface WorkflowSecurityIssue {
    nodeName?: string;
    severity?: string;
    type?: string;
}

interface WorkflowVisualizerProps {
    workflow: N8nWorkflow;
    nodes: N8nNode[];
    connections: unknown;
    issues: WorkflowSecurityIssue[];
}

const getNodeIcon = (type: string) => {
    const normalizedType = type.toLowerCase();
    if (normalizedType.includes('webhook')) return <Webhook className="h-5 w-5 text-pink-500" />;
    if (normalizedType.includes('schedule') || normalizedType.includes('interval')) return <Clock className="h-5 w-5 text-green-500" />;
    if (normalizedType.includes('postgres') || normalizedType.includes('mysql') || normalizedType.includes('mongo') || normalizedType.includes('db') || normalizedType.includes('database')) return <Database className="h-5 w-5 text-blue-500" />;
    if (normalizedType.includes('if')) return <Split className="h-5 w-5 text-orange-500" />;
    if (normalizedType.includes('switch')) return <GitFork className="h-5 w-5 text-orange-500" />;
    if (normalizedType.includes('http')) return <Globe className="h-5 w-5 text-purple-500" />;
    if (normalizedType.includes('set')) return <Edit3 className="h-5 w-5 text-yellow-500" />;
    if (normalizedType.includes('function') || normalizedType.includes('code')) return <Code className="h-5 w-5 text-red-500" />;
    if (normalizedType.includes('execute') || normalizedType.includes('command')) return <Terminal className="h-5 w-5 text-slate-400" />;
    if (normalizedType.includes('mail') || normalizedType.includes('smtp')) return <Mail className="h-5 w-5 text-red-400" />;
    if (normalizedType.includes('slack') || normalizedType.includes('discord') || normalizedType.includes('telegram')) return <MessageSquare className="h-5 w-5 text-indigo-400" />;
    if (normalizedType.includes('file') || normalizedType.includes('read') || normalizedType.includes('write')) return <FileText className="h-5 w-5 text-gray-400" />;
    if (normalizedType.includes('aws') || normalizedType.includes('s3')) return <UploadCloud className="h-5 w-5 text-orange-400" />;
    if (normalizedType.includes('trigger') || normalizedType.includes('form')) return <Zap className="h-5 w-5 text-yellow-400" />;

    return <Box className="h-5 w-5 text-gray-400" />;
};

function getSeverityStyle(nodeIssues: WorkflowSecurityIssue[]) {
    const severities = new Set(nodeIssues.map((issue) => issue.severity?.toLowerCase()));
    if (severities.has('critical')) return {
        background: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', shadow: 'rgba(239,68,68,0.4)', badge: 'bg-red-600 text-white',
    };
    if (severities.has('high')) return {
        background: 'rgba(249, 115, 22, 0.15)', border: '#f97316', shadow: 'rgba(249,115,22,0.4)', badge: 'bg-orange-500 text-white',
    };
    if (severities.has('medium')) return {
        background: 'rgba(234, 179, 8, 0.15)', border: '#eab308', shadow: 'rgba(234,179,8,0.4)', badge: 'bg-yellow-500 text-black',
    };
    if (severities.has('low')) return {
        background: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', shadow: 'rgba(59,130,246,0.4)', badge: 'bg-blue-500 text-white',
    };
    if (nodeIssues.length > 0) return {
        background: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', shadow: 'rgba(168,85,247,0.4)', badge: 'bg-purple-500 text-white',
    };
    return {
        background: 'rgba(30, 41, 59, 0.95)', border: '#64748b', shadow: 'rgba(0,0,0,0.1)', badge: 'bg-muted text-foreground',
    };
}

export function WorkflowVisualizer({ workflow, nodes, connections, issues }: WorkflowVisualizerProps) {
    const attackAnalysis = useMemo(
        () => analyzeWorkflowAttackPaths(nodes, connections, issues),
        [nodes, connections, issues],
    );
    const attackEntryNodes = useMemo(
        () => new Set(attackAnalysis.attackEntryNodeNames),
        [attackAnalysis.attackEntryNodeNames],
    );
    const normalEntryNodes = useMemo(
        () => new Set(attackAnalysis.entryNodeNames),
        [attackAnalysis.entryNodeNames],
    );
    const attackPathNodes = useMemo(
        () => new Set(attackAnalysis.attackPathNodeNames),
        [attackAnalysis.attackPathNodeNames],
    );
    const attackLinks = useMemo(
        () => new Set(attackAnalysis.attackLinks.map(({ source, target }) => `${source}\u0000${target}`)),
        [attackAnalysis.attackLinks],
    );

    const initialNodes = useMemo<Node[]>(() => {
        const workflowNodes: Node[] = nodes.map((node) => {
            const nodeIssues = issues.filter((issue) => issue.nodeName === node.name);
            const severityStyle = getSeverityStyle(nodeIssues);
            const issueLabel = nodeIssues
                .map((issue) => (issue.type || 'finding').replaceAll('_risk', '').replaceAll('_', ' '))
                .join(', ');
            const isAttackEntry = attackEntryNodes.has(node.name);
            const isNormalEntry = normalEntryNodes.has(node.name);
            const isAttackPath = attackPathNodes.has(node.name);
            const isVulnerable = nodeIssues.length > 0;

            return {
                id: node.name,
                position: {
                    x: Array.isArray(node.position) ? node.position[0] : 0,
                    y: Array.isArray(node.position) ? node.position[1] : 0,
                },
                data: {
                    label: (
                        <div className="flex flex-col items-center gap-1 text-center">
                            {isAttackEntry ? (
                                <span className="mb-1 rounded-full border border-rose-400/50 bg-rose-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-200">
                                    Attack entry
                                </span>
                            ) : isNormalEntry ? (
                                <span className="mb-1 rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-300">
                                    Trigger
                                </span>
                            ) : null}
                            <div className="mb-1 rounded-full bg-background/50 p-2 ring-1 ring-white/10">
                                {getNodeIcon(node.type)}
                            </div>
                            <span className="max-w-[135px] truncate text-xs font-bold" title={node.name}>{node.name}</span>
                            {isVulnerable && (
                                <span className={`max-w-[140px] truncate rounded px-1.5 py-0.5 text-[10px] uppercase tracking-tighter ${severityStyle.badge}`} title={issueLabel}>
                                    {issueLabel}
                                </span>
                            )}
                            {isAttackPath && !isAttackEntry && !isVulnerable && (
                                <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-medium text-rose-300">
                                    <Route className="h-2.5 w-2.5" /> Attack path
                                </span>
                            )}
                        </div>
                    ),
                    type: node.type,
                    isVulnerable,
                    isAttackEntry,
                    isNormalEntry,
                    isAttackPath,
                },
                style: {
                    alignItems: 'center',
                    backdropFilter: 'blur(10px)',
                    background: isVulnerable ? severityStyle.background : 'rgba(15, 23, 42, 0.95)',
                    border: isVulnerable
                        ? `2px solid ${severityStyle.border}`
                        : isAttackEntry
                        ? '2px solid #fb7185'
                        : isAttackPath
                        ? '2px solid #f43f5e'
                        : isNormalEntry
                        ? '2px solid #0284c7'
                        : '1px solid #334155',
                    borderRadius: '12px',
                    boxShadow: isVulnerable
                        ? `0 0 20px ${severityStyle.shadow}`
                        : isAttackEntry
                        ? '0 0 16px rgba(244,63,94,0.3)'
                        : isAttackPath
                        ? '0 0 12px rgba(244,63,94,0.2)'
                        : '0 4px 12px rgba(0,0,0,0.3)',
                    color: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    fontSize: '12px',
                    justifyContent: 'center',
                    minHeight: isAttackEntry || isNormalEntry ? 124 : 112,
                    outline: isAttackPath && !isAttackEntry && !isVulnerable ? '1px dashed rgba(251,113,133,0.7)' : undefined,
                    outlineOffset: isAttackPath ? '4px' : undefined,
                    padding: '10px',
                    width: 170,
                },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
            };
        });

        // ONLY render the external Attacker node when an actual exploit/attack path exists leading to a vulnerability
        if (!attackAnalysis.hasAttackPath || attackAnalysis.attackEntryNodeNames.length === 0) {
            return workflowNodes;
        }

        const entryPositions = nodes
            .filter((node) => attackEntryNodes.has(node.name))
            .map((node) => node.position);
        const allX = nodes.map((node) => node.position?.[0] ?? 0);
        const minX = allX.length > 0 ? Math.min(...allX) : 0;
        const averageEntryY = entryPositions.length > 0
            ? entryPositions.reduce((sum, position) => sum + (position?.[1] ?? 0), 0) / entryPositions.length
            : 0;
        const entryLabel = attackAnalysis.entryKind === 'external' ? 'External attack source' : 'Potential attack source';

        const attackerNode: Node = {
            id: ATTACKER_NODE_ID,
            position: { x: minX - 300, y: averageEntryY },
            data: {
                label: (
                    <div className="flex flex-col items-center gap-2 text-center">
                        <div className="rounded-full border border-red-400/50 bg-red-500/20 p-3">
                            <Crosshair className="h-7 w-7 text-red-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-red-100">Attacker</p>
                            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-red-300">{entryLabel}</p>
                        </div>
                    </div>
                ),
                isAttacker: true,
            },
            draggable: false,
            selectable: false,
            sourcePosition: Position.Right,
            style: {
                background: 'rgba(127, 29, 29, 0.92)',
                border: '2px solid #ef4444',
                borderRadius: '9999px',
                boxShadow: '0 0 32px rgba(239,68,68,0.45)',
                color: '#fff',
                height: 150,
                padding: '16px',
                width: 150,
            },
        };

        return [attackerNode, ...workflowNodes];
    }, [attackAnalysis.entryKind, attackAnalysis.hasAttackPath, attackAnalysis.attackEntryNodeNames.length, attackEntryNodes, normalEntryNodes, attackPathNodes, issues, nodes]);

    const initialEdges = useMemo<Edge[]>(() => {
        const workflowEdges: Edge[] = extractWorkflowLinks(connections).map(({ source, target }, index) => {
            const isAttackPath = attackLinks.has(`${source}\u0000${target}`);
            const stroke = isAttackPath ? '#f43f5e' : '#475569';

            return {
                id: `workflow-${source}-${target}-${index}`,
                source,
                target,
                animated: isAttackPath,
                type: 'smoothstep',
                zIndex: isAttackPath ? 5 : 1,
                style: {
                    filter: isAttackPath ? 'drop-shadow(0 0 4px rgba(244,63,94,0.75))' : undefined,
                    stroke,
                    strokeDasharray: isAttackPath ? '8 5' : undefined,
                    strokeWidth: isAttackPath ? 3 : 2,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: stroke,
                    height: isAttackPath ? 22 : 18,
                    width: isAttackPath ? 22 : 18,
                },
            };
        });

        if (!attackAnalysis.hasAttackPath || attackAnalysis.attackEntryNodeNames.length === 0) {
            return workflowEdges;
        }

        const attackerEdges: Edge[] = attackAnalysis.attackEntryNodeNames.map((entryNodeName, index) => ({
            id: `attacker-entry-${index}-${entryNodeName}`,
            source: ATTACKER_NODE_ID,
            target: entryNodeName,
            animated: true,
            label: 'attack entry',
            labelBgBorderRadius: 6,
            labelBgPadding: [6, 3],
            labelBgStyle: { fill: 'rgba(69,10,10,0.92)', fillOpacity: 1 },
            labelStyle: { fill: '#fecdd3', fontSize: 10, fontWeight: 700 },
            type: 'smoothstep',
            zIndex: 10,
            style: {
                filter: 'drop-shadow(0 0 5px rgba(239,68,68,0.8))',
                stroke: '#ef4444',
                strokeDasharray: '8 5',
                strokeWidth: 3,
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#ef4444',
                height: 24,
                width: 24,
            },
        }));

        return [...attackerEdges, ...workflowEdges];
    }, [attackAnalysis.attackEntryNodeNames, attackAnalysis.hasAttackPath, attackLinks, connections]);

    const [flowNodes, , onNodesChange] = useNodesState(initialNodes);
    const [flowEdges, , onEdgesChange] = useEdgesState(initialEdges);

    return (
        <div id="workflow-visualizer-canvas" className="h-[650px] w-full overflow-hidden rounded-lg border border-border bg-slate-950">
            <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.2, minZoom: 0.35, maxZoom: 1.2 }}
                minZoom={0.2}
            >
                <Background color="#334155" gap={18} />
                <Controls />
                <MiniMap
                    pannable
                    zoomable
                    style={{ background: '#020617' }}
                    nodeColor={(node) => {
                        if (node.id === ATTACKER_NODE_ID) return '#ef4444';
                        if (node.data?.isVulnerable) return '#ef4444';
                        if (node.data?.isAttackEntry) return '#fb7185';
                        if (node.data?.isAttackPath) return '#be123c';
                        if (node.data?.isNormalEntry) return '#0284c7';
                        return '#475569';
                    }}
                />
                <Panel position="top-right" className={`rounded-lg border bg-slate-950/90 p-3 text-xs shadow-xl backdrop-blur ${attackAnalysis.hasAttackPath ? 'border-rose-500/30 text-slate-200' : 'border-emerald-500/30 text-slate-200'}`}>
                    {attackAnalysis.hasAttackPath ? (
                        <>
                            <div className="flex items-center gap-2 font-semibold text-rose-300">
                                <Crosshair className="h-4 w-4 text-rose-400" /> Attack Path Analysis
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                                <div><p className="text-base font-bold text-white">{attackAnalysis.attackEntryNodeNames.length}</p><p className="text-[9px] uppercase text-slate-400">Attack Entries</p></div>
                                <div><p className="text-base font-bold text-rose-400">{attackAnalysis.vulnerableNodeNames.length}</p><p className="text-[9px] uppercase text-slate-400">Vulnerable</p></div>
                                <div><p className="text-base font-bold text-white">{attackAnalysis.maxDepth}</p><p className="text-[9px] uppercase text-slate-400">Max hops</p></div>
                            </div>
                            <div className="mt-2 flex items-center gap-2 border-t border-slate-800 pt-2 text-[10px] text-slate-400">
                                <span className="h-0.5 w-6 border-t-2 border-dashed border-rose-500" />
                                Active exploit path to vulnerable component
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 font-semibold text-emerald-400">
                                <ShieldCheck className="h-4 w-4 text-emerald-400" /> Workflow Topology
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                                <div><p className="text-base font-bold text-white">{attackAnalysis.entryNodeNames.length}</p><p className="text-[9px] uppercase text-slate-400">Triggers</p></div>
                                <div><p className="text-base font-bold text-white">{nodes.length}</p><p className="text-[9px] uppercase text-slate-400">Total Nodes</p></div>
                                <div><p className="text-base font-bold text-emerald-400">0</p><p className="text-[9px] uppercase text-slate-400">Threats</p></div>
                            </div>
                            <div className="mt-2 flex items-center gap-2 border-t border-slate-800 pt-2 text-[10px] text-emerald-400/90">
                                <CheckCircle className="h-3 w-3 text-emerald-400" />
                                Verified Secure • No attack entries or threats detected
                            </div>
                        </>
                    )}
                    <p className="mt-1 max-w-[220px] text-[9px] leading-relaxed text-slate-500">{workflow.name}</p>
                </Panel>
            </ReactFlow>
        </div>
    );
}
