export interface N8nNode {
    parameters: Record<string, any>;
    id: string;
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    credentials?: Record<string, any>;
}

export interface N8nConnection {
    node: string;
    type: string;
    index: number;
}

export interface N8nWorkflow {
    id: string;
    name: string;
    active: boolean;
    nodes: N8nNode[];
    connections: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    tags?: { createdAt: string; updatedAt: string; id: string; name: string }[];
    meta?: { owner?: string; published?: boolean };
}
