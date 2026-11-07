'use server'

// import { scanTarget } from './scanner'; // Removed, using internal logic now
import prisma from './db';
import IPCIDR from 'ip-cidr';
import dns from 'dns';
import { promisify } from 'util';
import { requireOperatorOrSystem, requirePermission } from './auth';

const lookup = promisify(dns.lookup);

async function resolveTarget(target: string): Promise<string[]> {
    target = target.trim();

    // Check if CIDR
    if (target.includes('/')) {
        try {
            const cidr = new IPCIDR(target);
            // isValid might not be available on all versions, but if start() works it's valid?
            // checking source code or assume valid if no error.
            if (!cidr.start()) {
                throw new Error(`Invalid CIDR: ${target}`);
            }
            const ips = cidr.toArray();
            // Limit to prevent abuse/performance issues
            if (ips.length > 256) {
                throw new Error(`Range too large (${ips.length} IPs). Max 256 allowed.`);
            }
            return ips;
        } catch (e) {
            throw new Error(`Invalid CIDR: ${target}`);
        }
    }

    // Check if IP
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(target)) {
        return [target];
    }

    // IPv6 regex/check could be added here, but complex.
    // Let's assume non-IPv4 might be domain or IPv6.

    // Resolve Domain (get ALL records)
    try {
        const addresses = await lookup(target, { all: true });
        return addresses.map(a => a.address);
    } catch (e) {
        console.error(`DNS lookup failed for ${target}:`, e);
        return [];
    }
}

import { probeAndExtractModels } from './model-extractor';

export async function scanAction(input: string) {
    await requireOperatorOrSystem();
    // 1. Parse Inputs
    const rawTargets = input.split(',').map(t => t.trim()).filter(Boolean);
    let uniqueIps = new Set<string>();

    for (const t of rawTargets) {
        try {
            const resolved = await resolveTarget(t);
            resolved.forEach(ip => uniqueIps.add(ip));
        } catch (e: any) {
            console.error(`Failed to resolve ${t}: ${e.message}`);
        }
    }

    const ipsToScan = Array.from(uniqueIps);
    if (ipsToScan.length === 0) {
        throw new Error("No valid targets found.");
    }

    // 2. Create Scan Result Record
    const scanRecord = await prisma.scanResult.create({
        data: {
            target: input,
            scannedAt: new Date()
        }
    });

    let allResults: any[] = [];
    const COMMON_LLM_PORTS = [11434, 8000, 8080, 5000, 3000, 1234, 9000];

    // 3. Scan IPs
    for (const ip of ipsToScan) {
        // We'll use the new probeAndExtractModels for each port
        // This replaces the old scanTarget logic for better modularity
        const results = [];

        for (const port of COMMON_LLM_PORTS) {
            const isOpen = await checkPort(ip, port);
            if (isOpen) {
                const fingerprint = await probeAndExtractModels(ip, port);
                results.push({
                    ip,
                    port,
                    open: true,
                    service: fingerprint.service,
                    models: fingerprint.models,
                    details: fingerprint.details
                });
            }
        }

        // 4. Save to Database
        if (results.length > 0) {
            for (const res of results) {
                const service = await prisma.service.create({
                    data: {
                        scanResultId: scanRecord.id,
                        ip: res.ip,
                        port: res.port,
                        name: res.service,
                        confidence: 100,
                        details: res.details ? JSON.stringify(res.details) : null,
                        models: res.models && res.models.length > 0 ? JSON.stringify(res.models) : null
                    }
                });

                // Log as potential LLM request for Shadow AI tracking
                const llmServices = ['ollama', 'vllm', 'openai', 'llm', 'anthropic', 'huggingface', 'lm studio', 'localai'];
                const isLlmService = llmServices.some(s => res.service.toLowerCase().includes(s));

                if (isLlmService) {
                    await prisma.lLMRequest.create({
                        data: {
                            sourceIp: 'scanner',
                            targetIp: res.ip,
                            targetPort: res.port,
                            provider: res.service,
                            riskScore: 0,
                            isFlagged: false,
                            serviceId: service.id,
                            // If models detected, log the first one as an example
                            model: res.models && res.models.length > 0 ? res.models[0] : null
                        }
                    });
                }
            }
            allResults = [...allResults, ...results];
        }
    }

    return allResults;
}

// Helper for checkPort since we are bypassing scanTarget
import net from 'net';
function checkPort(ip: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(1000);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('error', () => {
            resolve(false);
        });
        socket.connect(port, ip);
    });
}

export async function getPastScans() {
    await requirePermission('DISCOVERY_VIEW');
    return prisma.scanResult.findMany({
        take: 10,
        orderBy: { scannedAt: 'desc' },
        include: {
            services: true
        }
    });
}

export async function getUniqueAssets() {
    await requirePermission('DISCOVERY_VIEW');
    // Group by IP and Port to get unique services
    // Prisma doesn't support distinct on specific fields easily with findMany to get latest
    // So we'll fetch all and dedup in logic or use raw query if needed. 
    // For now, let's fetch all services and dedup by IP:Port
    const services = await prisma.service.findMany({
        orderBy: { id: 'desc' }, // Latest first roughly
        include: { scanResult: true }
    });

    const uniqueMap = new Map();
    for (const svc of services) {
        const key = `${svc.ip}:${svc.port}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, svc);
        }
    }

    return Array.from(uniqueMap.values());
}

export async function verifyAssets(assets: { ip: string; port: number }[]) {
    await requireOperatorOrSystem();
    const results = [];
    for (const asset of assets) {
        // Run in parallel chunks ideally, but sequential for safety for now
        // or Promise.all if list is small. 
        // User asked for bulk select verify.
        try {
            const isOpen = await checkPort(asset.ip, asset.port);
            const status = isOpen ? 'OPEN' : 'CLOSED';
            const details = isOpen ? 'Verified Open' : 'Connection Timed Out/Refused';

            // Update DB
            await prisma.service.updateMany({
                where: { ip: asset.ip, port: asset.port },
                data: {
                    lastVerifiedAt: new Date(),
                    active: isOpen,
                    status: status,
                    details: !isOpen ? JSON.stringify({ error: details }) : undefined // Update details if closed
                }
            });

            results.push({ ip: asset.ip, port: asset.port, status, details });
        } catch (e) {
            results.push({ ip: asset.ip, port: asset.port, status: 'ERROR', details: 'Verification failed' });
        }
    }
    return results;
}
