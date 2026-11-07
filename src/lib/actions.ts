'use server'

import { fetchWorkflows, fetchWorkflow, fetchWorkflowExecutions, fetchExecutionDetails } from './n8n';
import prisma from './db';
import { N8nWorkflow } from './types';
import { analyzeWorkflow, calculateRiskScore } from './security';
import { scanExecutionData } from './secret-scanner';
import { getGlobalCustomPatterns } from './settings-actions';
import { requireOperatorOrSystem, requirePermission } from './auth';


export async function syncWorkflows() {
    await requireOperatorOrSystem('WORKFLOWS_MANAGE');
    let syncedCount = 0;

    // Webhooks are now stored in their own table
    const customPatterns = await getGlobalCustomPatterns();

    const environments = await prisma.n8nEnvironment.findMany({ where: { isActive: true } });

    // Auto-migrate from env vars if no environments exist
    if (environments.length === 0 && process.env.N8N_BASE_URL && process.env.N8N_API_KEY) {
        const defaultEnv = await prisma.n8nEnvironment.create({
            data: {
                name: 'Default Environment',
                baseUrl: process.env.N8N_BASE_URL,
                apiKey: process.env.N8N_API_KEY,
                isActive: true
            }
        });
        environments.push(defaultEnv);
    }

    for (const env of environments) {
        if (!env.baseUrl || !env.apiKey) continue;
        const apiConfig = { apiKey: env.apiKey, baseUrl: env.baseUrl };

        // Auto-fetch and update version if changed
        const { fetchN8nVersion } = await import('./n8n');
        const currentVersion = await fetchN8nVersion(apiConfig);
        if (currentVersion && currentVersion !== env.version) {
            env.version = currentVersion;
            await prisma.n8nEnvironment.update({ where: { id: env.id }, data: { version: currentVersion } });
        }

        const workflows = await fetchWorkflows(apiConfig);
        const N8N_BASE_URL = env.baseUrl;

        for (const wf of workflows) {
            const existing = await prisma.workflow.findUnique({
                where: { id: wf.id }
            });

            // Always fetch full details to get nodes/connections
            const fullWf = await fetchWorkflow(apiConfig, wf.id);
            if (!fullWf) continue;

            // We will move the webhook extraction logic after the workflow is created/updated
            // to avoid foreign key constraint violations on fresh databases.
            const webhooksToProcess: any[] = [];
            for (const node of fullWf.nodes) {
                const isWebhook = node.type === 'n8n-nodes-base.webhook';
                const isForm = node.type === 'n8n-nodes-base.formTrigger';
                const isChat = node.type === 'n8n-nodes-base.chatTrigger';
                const isWait = node.type === 'n8n-nodes-base.wait' && node.parameters?.resume === 'webhook';

                if (isWebhook || isForm || isChat || isWait) {
                    webhooksToProcess.push(node);
                }
            }

            const nodesJson = JSON.stringify(fullWf.nodes);
            const connectionsJson = JSON.stringify(fullWf.connections);

            // Extract Workflow Metadata
            const owner = fullWf.meta?.owner || (fullWf as any).owner || null;
            const published = fullWf.meta?.published !== undefined ? fullWf.meta.published : ((fullWf as any).published !== undefined ? (fullWf as any).published : null);
            const n8nCreatedAt = fullWf.createdAt ? new Date(fullWf.createdAt) : null;
            const n8nUpdatedAt = fullWf.updatedAt ? new Date(fullWf.updatedAt) : null;

            // Extract Node Credentials
            const extractedCredentials = new Map<string, { name: string, type: string }>();
            for (const node of fullWf.nodes) {
                if (node.credentials) {
                    for (const [key, val] of Object.entries(node.credentials)) {
                        const credId = val.id;
                        if (credId && typeof credId === 'string') {
                            extractedCredentials.set(credId, {
                                name: val.name || key,
                                type: key
                            });
                        }
                    }
                }
            }

            const analysis = analyzeWorkflow(fullWf);
            const riskScore = calculateRiskScore(analysis);

            const securityIssuesJson = JSON.stringify(analysis);

            // Fetch and scan last 10 executions for suspicious inputs
            let hasSuspiciousInput = false;
            try {
                const lastExecutions = await fetchWorkflowExecutions(apiConfig, wf.id, 10);
                for (const exec of lastExecutions) {
                    const details = await fetchExecutionDetails(apiConfig, exec.id);
                    if (details) {
                        const findings = scanExecutionData(details, customPatterns);
                        if (findings.length > 0) {
                            hasSuspiciousInput = true;
                            break;
                        }
                    }
                }
            } catch (e) {
                console.error(`Failed to scan executions for workflow ${wf.id}`, e);
            }

            if (!existing) {
                await prisma.workflow.create({
                    data: {
                        id: fullWf.id,
                        name: fullWf.name,
                        active: fullWf.active,
                        nodes: nodesJson,
                        connections: connectionsJson,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        securityIssues: securityIssuesJson,
                        riskScore,
                        hasSuspiciousInput,
                        n8nCreatedAt,
                        n8nUpdatedAt,
                        owner,
                        published,
                        environmentId: env.id,
                        history: {
                            create: {
                                version: 1,
                                nodes: nodesJson,
                                connections: connectionsJson
                            }
                        }
                    }
                });
                syncedCount++;
            } else {
                const hasChanged = existing.nodes !== nodesJson || existing.connections !== connectionsJson;

                if (hasChanged) {
                    const lastHistory = await prisma.workflowHistory.findFirst({
                        where: { workflowId: fullWf.id },
                        orderBy: { version: 'desc' }
                    });
                    const nextVersion = (lastHistory?.version || 0) + 1;

                    await prisma.workflow.update({
                        where: { id: fullWf.id },
                        data: {
                            name: fullWf.name,
                            active: fullWf.active,
                            nodes: nodesJson,
                            connections: connectionsJson,
                            updatedAt: new Date(),
                            securityIssues: securityIssuesJson,
                            riskScore,
                            hasSuspiciousInput,
                            n8nCreatedAt,
                            n8nUpdatedAt,
                            owner,
                            published,
                            environmentId: env.id,
                            history: {
                                create: {
                                    version: nextVersion,
                                    nodes: nodesJson,
                                    connections: connectionsJson
                                }
                            }
                        }
                    });
                    syncedCount++;
                } else {
                    // ALWAYS update security issues and risk score to ensure latest analysis logic is applied
                    // This fixes the "empty Node Index" issue if the logic changed but workflow didn't.
                    await prisma.workflow.update({
                        where: { id: fullWf.id },
                        data: {
                            name: fullWf.name,
                            active: fullWf.active,
                            updatedAt: new Date(),
                            securityIssues: securityIssuesJson,
                            riskScore,
                            hasSuspiciousInput,
                            n8nCreatedAt,
                            n8nUpdatedAt,
                            owner,
                            published,
                            environmentId: env.id
                        }
                    });
                }
            }

            // Sync Webhooks AFTER workflow is created/updated to satisfy foreign key constraints
            for (const node of webhooksToProcess) {
                const isWebhook = node.type === 'n8n-nodes-base.webhook';
                const isForm = node.type === 'n8n-nodes-base.formTrigger';
                const isChat = node.type === 'n8n-nodes-base.chatTrigger';
                const isWait = node.type === 'n8n-nodes-base.wait' && node.parameters?.resume === 'webhook';

                const path = node.parameters?.path || (node as any).webhookId || '';
                const method = isWebhook ? (node.parameters?.httpMethod || 'GET') : 'GET';

                const cleanBase = N8N_BASE_URL.replace(/\/$/, "");
                const cleanPath = path.toString().startsWith('/') ? path.toString().slice(1) : path;

                let endpointType: string;
                let urlPrefix: string;

                if (isForm) {
                    endpointType = 'form';
                    urlPrefix = 'form';
                } else if (isChat) {
                    endpointType = 'chat';
                    urlPrefix = 'webhook';
                } else if (isWait) {
                    endpointType = 'wait';
                    urlPrefix = 'webhook';
                } else {
                    endpointType = 'webhook';
                    urlPrefix = 'webhook';
                }

                const prodUrl = `${cleanBase}/${urlPrefix}/${cleanPath}`;
                const testUrl = `${cleanBase}/${urlPrefix}-test/${cleanPath}`;

                // Upsert endpoint
                const existingWebhook = await prisma.webhook.findFirst({
                    where: {
                        workflowId: wf.id,
                        nodeName: node.name
                    }
                });

                if (existingWebhook) {
                    await prisma.webhook.update({
                        where: { id: existingWebhook.id },
                        data: {
                            method: method.toString(),
                            path: path.toString(),
                            testUrl,
                            prodUrl,
                            active: fullWf.active,
                            type: endpointType
                        }
                    });
                } else {
                    await prisma.webhook.create({
                        data: {
                            workflowId: wf.id,
                            nodeName: node.name,
                            method: method.toString(),
                            path: path.toString(),
                            testUrl,
                            prodUrl,
                            active: fullWf.active,
                            type: endpointType
                        }
                    });
                }
            }

            // Sync Credentials Extracted from this Workflow
            for (const [credId, credData] of extractedCredentials.entries()) {
                const existingCred = await prisma.credential.findUnique({ where: { id: credId } });

                if (existingCred) {
                    // Update workflows array if this workflow isn't already inside
                    let workflowsList: string[] = [];
                    try { workflowsList = JSON.parse(existingCred.workflows); } catch (e) { }
                    if (!workflowsList.includes(fullWf.id)) {
                        workflowsList.push(fullWf.id);
                        await prisma.credential.update({
                            where: { id: credId },
                            data: { workflows: JSON.stringify(workflowsList) }
                        });
                    }
                } else {
                    await prisma.credential.create({
                        data: {
                            id: credId,
                            name: credData.name,
                            type: credData.type,
                            environmentId: env.id,
                            workflows: JSON.stringify([fullWf.id])
                        }
                    });
                }
            }
        }
    }
    return syncedCount;
}

export async function rescanService(ip: string, port: number) {
    await requireOperatorOrSystem('DISCOVERY_RUN');
    const { Socket } = require('net');
    const socket = new Socket();

    return new Promise<{ isOpen: boolean }>((resolve) => {
        socket.setTimeout(2000);
        socket.on('connect', () => {
            socket.destroy();
            resolve({ isOpen: true });
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve({ isOpen: false });
        });
        socket.on('error', () => {
            socket.destroy();
            resolve({ isOpen: false });
        });
        socket.connect(port, ip);
    }).then(async (result) => {
        if (result.isOpen) {
            await prisma.service.updateMany({
                where: { ip, port },
                data: { lastSeen: new Date(), active: true }
            });
        }
        return result.isOpen;
    });
}

export async function getRecentActivity() {
    await requirePermission('DASHBOARD_VIEW');
    const riskyWorkflows = await prisma.workflow.findMany({
        where: { riskScore: { gt: 0 } },
        orderBy: { updatedAt: 'desc' },
        take: 5
    });

    const newServices = await prisma.service.findMany({
        orderBy: { firstSeen: 'desc' },
        take: 5
    });

    const recentScans = await prisma.scanResult.findMany({
        orderBy: { scannedAt: 'desc' },
        take: 3
    });

    const spotterScans = await prisma.spotterScan.findMany({ orderBy: { createdAt: 'desc' }, take: 3 });
    const skillScans = await prisma.skillScan.findMany({ orderBy: { createdAt: 'desc' }, take: 3 });
    const mcpScans = await prisma.mcpScan.findMany({ orderBy: { createdAt: 'desc' }, take: 3 });
    const aibomScans = await prisma.aibomScan.findMany({ orderBy: { createdAt: 'desc' }, take: 3 });

    let n8nVulnActivities: any[] = [];
    try {
        const { environments } = await getN8nAdvisories();
        environments.forEach(env => {
            if (env.affectedVulnerabilities && env.affectedVulnerabilities.length > 0) {
                // Determine highest severity
                const hasCritical = env.affectedVulnerabilities.some(v => v.severity === 'CRITICAL');

                // Use the latest published vulnerability date as the timestamp
                const latestVulnDate = new Date(Math.max(...env.affectedVulnerabilities.map(v => new Date(v.published).getTime())));

                n8nVulnActivities.push({
                    id: `env-vuln-${env.id}`,
                    type: 'workflow_risk', // using workflow_risk icon for now
                    title: `Vulnerable n8n Instance: ${env.name}`,
                    description: `${env.affectedVulnerabilities.length} known vulnerabilites for version ${env.version || 'Unknown'}.`,
                    timestamp: latestVulnDate,
                    metadata: { severity: hasCritical ? 'critical' : 'high' }
                });
            }
        });
    } catch (e) {
        console.error("Failed to fetch n8n advisories for recent activity", e);
    }

    const activities = [
        ...n8nVulnActivities,
        ...riskyWorkflows.map(w => ({
            id: `wf-${w.id}`,
            type: 'workflow_risk',
            title: `Risk Detected in ${w.name}`,
            description: `Score: ${w.riskScore}. detected issues.`,
            timestamp: w.updatedAt,
            metadata: { id: w.id }
        })),
        ...newServices.map(s => ({
            id: `svc-${s.id}`,
            type: 'new_service',
            title: `New Service Discovered: ${s.name || 'Unknown'}`,
            description: `${s.ip}:${s.port} (${s.protocol})`,
            timestamp: s.firstSeen,
            metadata: { ip: s.ip, port: s.port }
        })),
        ...recentScans.map(s => ({
            id: `scan-${s.id}`,
            type: 'scan_complete',
            title: `Network Scan Completed`,
            description: `Scan target: ${s.target}`,
            timestamp: s.scannedAt,
            metadata: { id: s.id }
        })),
        ...spotterScans.map(s => ({
            id: `spotter-${s.id}`,
            type: 'spotter_scan',
            title: `AI Spotter Scan`,
            description: `Scanned ${s.repoUrl}. Found ${s.totalDetections} dependencies.`,
            timestamp: s.createdAt,
            metadata: { status: s.status }
        })),
        ...skillScans.map(s => ({
            id: `skill-${s.id}`,
            type: 'skill_scan',
            title: `Skill Scanner`,
            description: `Audited logic for ${s.target}. ${s.hasFindings ? 'Vulnerabilities found.' : 'Safe logic.'}`,
            timestamp: s.createdAt,
            metadata: { status: s.status }
        })),
        ...mcpScans.map(s => ({
            id: `mcp-${s.id}`,
            type: 'mcp_scan',
            title: `MCP Discovery`,
            description: `Scanned ${s.target}. ${s.isMcp ? 'Valid MCP server connected.' : 'Not an MCP server.'}`,
            timestamp: s.createdAt,
            metadata: { status: s.status }
        })),
        ...aibomScans.map(s => ({
            id: `aibom-${s.id}`,
            type: 'aibom_scan',
            title: `AI BOM Export`,
            description: `Cataloged ${s.totalComponents} AI components from ${s.target}.`,
            timestamp: s.createdAt,
            metadata: { status: s.status }
        }))
    ];

    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
}

export async function getWorkflowStats() {
    await requirePermission('DASHBOARD_VIEW');
    const total = await prisma.workflow.count();
    const active = await prisma.workflow.count({ where: { active: true } });
    const risky = await prisma.workflow.count({ where: { riskScore: { gt: 0 } } });
    // const services = await prisma.service.count(); // TODO: Add scans later
    return { total, active, risky };
}

export async function getWorkflows() {
    await requirePermission('WORKFLOWS_VIEW');
    return prisma.workflow.findMany({
        orderBy: { updatedAt: 'desc' },
        // N8nEnvironment.apiKey/baseUrl are admin-only material
        // (getEnvironments requires SETTINGS_MANAGE): project the relation
        // down to display fields so the key never crosses the
        // server->client boundary in an RSC payload or action return.
        include: { environment: { select: { id: true, name: true } } }
    });
}

export async function getCredentials() {
    await requirePermission('CREDENTIALS_VIEW');
    return prisma.credential.findMany({
        include: {
            environment: true
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });
}

export async function getWorkflowsByIds(ids: string[]) {
    await requirePermission('WORKFLOWS_VIEW');
    return prisma.workflow.findMany({
        where: {
            id: { in: ids }
        },
        include: {
            environment: { select: { id: true, name: true } }
        }
    });
}

export async function importWorkflow(jsonString: string) {
    await requireOperatorOrSystem('WORKFLOWS_MANAGE');
    try {
        const parsed = JSON.parse(jsonString);
        let workflowsToProcess = [];
        if (Array.isArray(parsed)) {
            // Check if this is an array of nodes (each item has 'type' and 'parameters')
            // vs an array of workflows (each item has 'nodes' array)
            const looksLikeNodes = parsed.length > 0 && parsed[0].type && !parsed[0].nodes;
            if (looksLikeNodes) {
                // It's a nodes array — wrap as a single workflow
                workflowsToProcess = [{
                    id: Math.random().toString(36).substring(2, 10),
                    name: 'Imported Workflow',
                    active: false,
                    nodes: parsed,
                    connections: {},
                }];
            } else {
                workflowsToProcess = parsed;
            }
        } else {
            workflowsToProcess = [parsed];
        }

        let importedCount = 0;

        for (const wf of workflowsToProcess) {
            // Need N8nWorkflow shape roughly
            const workflowToSave: N8nWorkflow = {
                id: wf.id || Math.random().toString(36).substring(7),
                name: wf.name || 'Imported Workflow',
                active: wf.active || false,
                nodes: wf.nodes || [],
                connections: wf.connections || {},
                createdAt: wf.createdAt || new Date().toISOString(),
                updatedAt: wf.updatedAt || new Date().toISOString(),
                tags: wf.tags,
                meta: wf.meta,
            };

            const nodesJson = JSON.stringify(workflowToSave.nodes);
            const connectionsJson = JSON.stringify(workflowToSave.connections);

            const analysis = analyzeWorkflow(workflowToSave);
            const riskScore = calculateRiskScore(analysis);
            const securityIssuesJson = JSON.stringify(analysis);
            
            const n8nCreatedAt = workflowToSave.createdAt ? new Date(workflowToSave.createdAt) : new Date();
            const n8nUpdatedAt = workflowToSave.updatedAt ? new Date(workflowToSave.updatedAt) : new Date();

            const existing = await prisma.workflow.findUnique({
                where: { id: workflowToSave.id }
            });

            if (!existing) {
                await prisma.workflow.create({
                    data: {
                        id: workflowToSave.id,
                        name: workflowToSave.name,
                        active: workflowToSave.active,
                        nodes: nodesJson,
                        connections: connectionsJson,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        securityIssues: securityIssuesJson,
                        riskScore,
                        hasSuspiciousInput: false,
                        n8nCreatedAt,
                        n8nUpdatedAt,
                        owner: workflowToSave.meta?.owner,
                        history: {
                            create: {
                                version: 1,
                                nodes: nodesJson,
                                connections: connectionsJson
                            }
                        }
                    }
                });
            } else {
                const lastHistory = await prisma.workflowHistory.findFirst({
                    where: { workflowId: workflowToSave.id },
                    orderBy: { version: 'desc' }
                });
                const nextVersion = (lastHistory?.version || 0) + 1;

                await prisma.workflow.update({
                    where: { id: workflowToSave.id },
                    data: {
                        name: workflowToSave.name,
                        active: workflowToSave.active,
                        nodes: nodesJson,
                        connections: connectionsJson,
                        updatedAt: new Date(),
                        securityIssues: securityIssuesJson,
                        riskScore,
                        n8nCreatedAt,
                        n8nUpdatedAt,
                        owner: workflowToSave.meta?.owner,
                        history: {
                            create: {
                                version: nextVersion,
                                nodes: nodesJson,
                                connections: connectionsJson
                            }
                        }
                    }
                });
            }
            importedCount++;
        }
        return { success: true, count: importedCount };
    } catch (e: any) {
        console.error("Failed to import workflow", e);
        return { success: false, error: e.message };
    }
}

// ==========================================
// N8n Environment Actions
// ==========================================

export async function getEnvironments() {
    await requirePermission('SETTINGS_MANAGE');
    return prisma.n8nEnvironment.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createEnvironment(data: { name: string; baseUrl: string; apiKey: string; version?: string; isActive?: boolean }) {
    await requirePermission('SETTINGS_MANAGE');
    return prisma.n8nEnvironment.create({ data });
}

export async function updateEnvironment(id: string, data: { name: string; baseUrl: string; apiKey: string; version?: string; isActive?: boolean }) {
    await requirePermission('SETTINGS_MANAGE');
    return prisma.n8nEnvironment.update({ where: { id }, data });
}

export async function deleteEnvironment(id: string) {
    await requirePermission('SETTINGS_MANAGE');
    return prisma.n8nEnvironment.delete({ where: { id } });
}

export async function getN8nStatusAction() {
    const env = await prisma.n8nEnvironment.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' }
    });

    const baseUrl = env?.baseUrl || process.env.N8N_BASE_URL || '';
    const apiKey = env?.apiKey || process.env.N8N_API_KEY || '';

    const { checkN8nStatus } = await import('./n8n');
    return checkN8nStatus({ baseUrl, apiKey });
}

export async function getWorkflow(id: string) {
    await requirePermission('WORKFLOWS_VIEW');
    const decoded = decodeURIComponent(id);
    const wf = await prisma.workflow.findUnique({
        where: { id: decoded },
        include: { environment: { select: { id: true, name: true } }, history: { orderBy: { version: 'desc' } } }
    });
    if (wf) return wf;

    return prisma.workflow.findFirst({
        where: {
            OR: [
                { id },
                { name: decoded },
                { name: id }
            ]
        },
        include: { environment: { select: { id: true, name: true } }, history: { orderBy: { version: 'desc' } } }
    });
}

// ==========================================
// Shadow AI Detection Actions
// ==========================================

export async function getShadowAIStats() {
    await requirePermission('SHADOW_AI_VIEW');
    const totalRequests = await prisma.lLMRequest.count();
    const flaggedRequests = await prisma.lLMRequest.count({ where: { isFlagged: true } });
    const activeRules = await prisma.detectionRule.count({ where: { enabled: true } });
    const unresolvedAlerts = await prisma.threatAlert.count({ where: { acknowledged: false } });

    // Average risk score
    const avgResult = await prisma.lLMRequest.aggregate({
        _avg: { riskScore: true }
    });
    const avgRiskScore = Math.round(avgResult._avg.riskScore || 0);

    return {
        totalRequests,
        flaggedRequests,
        activeRules,
        unresolvedAlerts,
        avgRiskScore
    };
}

export async function getDetectionRules() {
    await requirePermission('SHADOW_AI_VIEW');
    return prisma.detectionRule.findMany({
        orderBy: { createdAt: 'desc' }
    });
}

export async function createDetectionRule(data: {
    name: string;
    type: string;
    pattern: string;
    severity: string;
    points: number;
}) {
    await requireOperatorOrSystem('SHADOW_AI_MANAGE');
    return prisma.detectionRule.create({ data });
}

export async function toggleDetectionRule(id: string, enabled: boolean) {
    await requireOperatorOrSystem('SHADOW_AI_MANAGE');
    return prisma.detectionRule.update({
        where: { id },
        data: { enabled }
    });
}

export async function deleteDetectionRule(id: string) {
    await requireOperatorOrSystem('SHADOW_AI_MANAGE');
    return prisma.detectionRule.delete({ where: { id } });
}

export async function getLLMRequests(options?: { limit?: number; flaggedOnly?: boolean }) {
    await requirePermission('SHADOW_AI_VIEW');
    return prisma.lLMRequest.findMany({
        where: options?.flaggedOnly ? { isFlagged: true } : undefined,
        orderBy: { timestamp: 'desc' },
        take: options?.limit || 50,
        include: { service: true }
    });
}

export async function getThreatAlerts(acknowledgedFilter?: boolean) {
    await requirePermission('SHADOW_AI_VIEW');
    return prisma.threatAlert.findMany({
        where: acknowledgedFilter !== undefined ? { acknowledged: acknowledgedFilter } : undefined,
        orderBy: { timestamp: 'desc' },
        take: 50
    });
}

export async function acknowledgeAlert(id: string) {
    await requireOperatorOrSystem('SHADOW_AI_MANAGE');
    return prisma.threatAlert.update({
        where: { id },
        data: { acknowledged: true }
    });
}

export async function logLLMRequest(data: {
    sourceIp: string;
    targetIp: string;
    targetPort: number;
    provider?: string;
    model?: string;
    promptHash?: string;
    riskScore: number;
    isFlagged: boolean;
    flags?: string;
    responseTime?: number;
    serviceId?: string;
}) {
    await requireOperatorOrSystem('SHADOW_AI_MANAGE');
    const request = await prisma.lLMRequest.create({ data });

    // Create alert if flagged
    if (data.isFlagged) {
        await prisma.threatAlert.create({
            data: {
                requestId: request.id,
                severity: data.riskScore >= 70 ? 'critical' : data.riskScore >= 50 ? 'high' : 'medium',
                message: `Flagged LLM request from ${data.sourceIp} to ${data.targetIp}:${data.targetPort}. Risk Score: ${data.riskScore}`
            }
        });
    }

    return request;
}

// Seed default rules if none exist
export async function seedDefaultRules() {
    await requirePermission('SHADOW_AI_VIEW');
    const count = await prisma.detectionRule.count();
    if (count > 0) return; // Already seeded

    const defaultRules = [
        { name: 'Credit Card Number', type: 'regex', pattern: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b', severity: 'critical', points: 75 },
        { name: 'Social Security Number', type: 'regex', pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', severity: 'critical', points: 80 },
        { name: 'API Key Pattern', type: 'regex', pattern: 'sk-[a-zA-Z0-9]{20,}', severity: 'high', points: 60 },
        { name: 'AWS Access Key', type: 'regex', pattern: 'AKIA[0-9A-Z]{16}', severity: 'critical', points: 90 },
        { name: 'Password Mention', type: 'keyword', pattern: 'password', severity: 'medium', points: 20 },
        { name: 'Secret Mention', type: 'keyword', pattern: 'secret', severity: 'medium', points: 20 },
        { name: 'Confidential Data', type: 'keyword', pattern: 'confidential', severity: 'medium', points: 15 },
    ];

    for (const rule of defaultRules) {
        await prisma.detectionRule.create({ data: rule });
    }
}

export async function getDiscoveryStats() {
    await requirePermission('DASHBOARD_VIEW');
    try {
        const spotters = await prisma.spotterScan.count();
        const sumSpotterDetections = await prisma.spotterScan.aggregate({ _sum: { totalDetections: true } });

        const skills = await prisma.skillScan.count();
        const skillsWithFindings = await prisma.skillScan.count({ where: { hasFindings: true } });

        const mcps = await prisma.mcpScan.count();
        const mcpFound = await prisma.mcpScan.count({ where: { isMcp: true } });

        const aiboms = await prisma.aibomScan.count();
        const sumAibomComps = await prisma.aibomScan.aggregate({ _sum: { totalComponents: true } });

        return {
            spotters,
            spotterDetections: sumSpotterDetections._sum.totalDetections || 0,
            skills,
            skillsWithFindings,
            mcps,
            mcpFound,
            aiboms,
            aibomComponents: sumAibomComps._sum.totalComponents || 0
        };
    } catch (e) {
        console.error("Failed getting discovery stats", e);
        return {
            spotters: 0, spotterDetections: 0,
            skills: 0, skillsWithFindings: 0,
            mcps: 0, mcpFound: 0,
            aiboms: 0, aibomComponents: 0
        };
    }
}

export async function getWorkflowExecutions(workflowId: string, limit: number = 20) {
    await requirePermission('EXECUTIONS_VIEW');
    const { fetchWorkflowExecutions } = await import('./n8n');
    const wf = await prisma.workflow.findUnique({ where: { id: workflowId }, include: { environment: true } });
    if (!wf || !wf.environment || !wf.environment.apiKey) {
        const dbExecs = await prisma.execution.findMany({
            where: { workflowId },
            orderBy: { startedAt: 'desc' },
            take: limit
        });
        return dbExecs.map(e => ({
            id: e.id,
            finished: e.finishedAt !== null,
            mode: e.mode,
            startedAt: e.startedAt.toISOString(),
            stoppedAt: e.finishedAt ? e.finishedAt.toISOString() : undefined,
            workflowId: e.workflowId,
            status: e.status
        }));
    }
    const execs = await fetchWorkflowExecutions({ apiKey: wf.environment.apiKey, baseUrl: wf.environment.baseUrl }, workflowId, limit);
    if (!execs || execs.length === 0) {
        const dbExecs = await prisma.execution.findMany({
            where: { workflowId },
            orderBy: { startedAt: 'desc' },
            take: limit
        });
        if (dbExecs.length > 0) {
            return dbExecs.map(e => ({
                id: e.id,
                finished: e.finishedAt !== null,
                mode: e.mode,
                startedAt: e.startedAt.toISOString(),
                stoppedAt: e.finishedAt ? e.finishedAt.toISOString() : undefined,
                workflowId: e.workflowId,
                status: e.status
            }));
        }
    }
    return execs;
}

export async function getGlobalExecutions(limit: number = 20) {
    await requirePermission('EXECUTIONS_VIEW');
    const { fetchWorkflowExecutions } = await import('./n8n');

    // Get all workflows (active or not) to show true global history
    const workflows = await prisma.workflow.findMany({
        include: { environment: true }
    });

    console.log(`[getGlobalExecutions] Fetching with global target limit: ${limit}`);
    let allExecutions: any[] = [];

    // Process environments and workflows
    for (const wf of workflows) {
        if (!wf.environment || !wf.environment.apiKey) continue;

        try {
            // Fetch top N executions for this workflow. 
            // We fetch the full 'limit' per workflow just in case one workflow dominates recent history.
            const execs = await fetchWorkflowExecutions(
                { apiKey: wf.environment.apiKey, baseUrl: wf.environment.baseUrl },
                wf.id,
                limit
            );

            // Tag executions with the workflow name and ID so the global page knows where they came from
            const taggedExecs = execs.map(e => ({
                ...e,
                workflowName: wf.name,
                workflowId: wf.id,
                environmentName: wf.environment?.name || "Unknown"
            }));

            allExecutions = [...allExecutions, ...taggedExecs];
        } catch (error) {
            console.error(`Failed to fetch executions for workflow ${wf.id}:`, error);
        }
    }

    // If no executions gathered from live n8n, fallback to local database executions
    if (allExecutions.length === 0) {
        const dbExecutions = await prisma.execution.findMany({
            include: {
                workflow: {
                    include: { environment: true }
                }
            },
            orderBy: { startedAt: 'desc' },
            take: limit
        });

        if (dbExecutions.length > 0) {
            allExecutions = dbExecutions.map(e => ({
                id: e.id,
                finished: e.finishedAt !== null,
                mode: e.mode,
                startedAt: e.startedAt.toISOString(),
                stoppedAt: e.finishedAt ? e.finishedAt.toISOString() : undefined,
                workflowId: e.workflowId,
                workflowName: e.workflow?.name || 'Workflow',
                environmentName: e.workflow?.environment?.name || 'Local Environment',
                status: e.status
            }));
        }
    }

    // Sort all gathered executions by startedAt desc
    allExecutions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    // Return only the top limit executions globally
    return allExecutions.slice(0, limit);
}

export async function getExecutionDetails(executionId: string, workflowId: string) {
    await requirePermission('EXECUTIONS_VIEW');
    const { getSampleExecutionDetails } = await import('./sample-executions');
    const sampleDetail = getSampleExecutionDetails(executionId);

    // If this is a sample ID or if it matches our sample fixtures, return it directly
    if (executionId.startsWith('exec-')) {
        return sampleDetail;
    }

    const { fetchExecutionDetails } = await import('./n8n');
    const wf = await prisma.workflow.findUnique({ where: { id: workflowId }, include: { environment: true } });
    if (!wf || !wf.environment || !wf.environment.apiKey) {
        return sampleDetail;
    }
    const result = await fetchExecutionDetails({ apiKey: wf.environment.apiKey, baseUrl: wf.environment.baseUrl }, executionId);
    return result || sampleDetail;
}

// ==========================================
// Security Advisories Actions
// ==========================================

export async function getN8nAdvisories() {
    await requirePermission('SECURITY_VIEW');
    const { fetchN8nAdvisories, parseVulnerability, isVersionVulnerable } = await import('./osv-api');
    const { fetchN8nVersion } = await import('./n8n');

    // Fetch raw advisories from OSV
    const rawAdvisories = await fetchN8nAdvisories();

    // Fetch environments
    const environments = await prisma.n8nEnvironment.findMany({ where: { isActive: true } });

    // Auto-discover missing versions
    for (const env of environments) {
        if (!env.version) {
            const version = await fetchN8nVersion({ baseUrl: env.baseUrl, apiKey: env.apiKey || '' });
            if (version) {
                env.version = version;
                await prisma.n8nEnvironment.update({ where: { id: env.id }, data: { version } });
            }
        }
    }

    // Parse advisories
    const parsedAdvisories = rawAdvisories.map(parseVulnerability);

    // Check which environments are affected by which vulnerabilities
    const result = {
        advisories: parsedAdvisories,
        environments: environments.map(env => {
            const version = env.version || 'Unknown';
            const affectedAdvisories = parsedAdvisories.filter(adv => {
                if (version === 'Unknown') return false;
                const rawAdv = rawAdvisories.find(r => r.id === adv.id);
                if (!rawAdv) return false;
                return isVersionVulnerable(version, rawAdv).vulnerable;
            });

            return {
                ...env,
                affectedVulnerabilities: affectedAdvisories
            };
        })
    };

    return result;
}

export async function forceRefreshAdvisories() {
    await requireOperatorOrSystem('SECURITY_MANAGE');
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/n8n-security');
    return { success: true };
}
export async function getFindingStatuses() {
    await requirePermission('SECURITY_VIEW');
    return prisma.findingStatus.findMany();
}

export async function updateFindingStatus(data: {
    fingerprint: string;
    status: string;
    workflowId?: string;
    nodeId?: string;
    findingType?: string;
}) {
    await requireOperatorOrSystem('SECURITY_MANAGE');
    return prisma.findingStatus.upsert({
        where: { fingerprint: data.fingerprint },
        update: { status: data.status },
        create: {
            fingerprint: data.fingerprint,
            status: data.status,
            workflowId: data.workflowId,
            nodeId: data.nodeId,
            findingType: data.findingType
        }
    });
}
