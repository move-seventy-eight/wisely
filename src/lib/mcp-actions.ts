'use server';

import { execFile } from 'child_process';
import { promisify } from 'util';
import prisma from './db';
import { requireOperatorOrSystem, requirePermission } from './auth';

const execFileAsync = promisify(execFile);

export interface McpScanResult {
    url?: string;
    isMcp?: boolean;
    details?: any; // To hold the rich JSON from mcp-scan
    error?: string;
    rawOutput?: string;
}

function normalizeMcpResults(stdout: string): { servers: Record<string, any>, raw: any } {
    try {
        const parsed = JSON.parse(stdout);
        const servers: Record<string, any> = {};

        // Helper to process a flat 'servers' array from mcp-scan
        const processServers = (serverList: any[], issues: any[]) => {
            if (!Array.isArray(serverList)) return;
            serverList.forEach((s: any, idx: number) => {
                if (s && s.name) {
                    // Find issues associated with this server index
                    const serverIssues = (issues || []).filter((iss: any) =>
                        iss.reference && iss.reference[0] === idx
                    ).map((iss: any) => ({
                        type: iss.code,
                        description: iss.message,
                        details: iss.extra_data
                    }));

                    servers[s.name] = {
                        ...s,
                        vulnerabilities: serverIssues
                    };
                }
            });
        };

        if (parsed.servers && Array.isArray(parsed.servers)) {
            processServers(parsed.servers, parsed.issues);
        } else {
            // Check for nested structure: { "filename.json": { "servers": [...], "issues": [...] } }
            Object.values(parsed).forEach((val: any) => {
                if (val && Array.isArray(val.servers)) {
                    processServers(val.servers, val.issues);
                }
            });
        }

        return { servers, raw: parsed };
    } catch (e) {
        return { servers: {}, raw: null };
    }
}

export async function runMcpAutoDiscovery(): Promise<McpScanResult> {
    await requireOperatorOrSystem();
    try {
        // Run mcp-scan without arguments to auto-discover local MCP configs
        // Using --json output flag for parsing
        const { stdout, stderr } = await execFileAsync('mcp-scan', ['scan', '--json']);

        try {
            const { servers, raw } = normalizeMcpResults(stdout);
            const isMcp = Object.keys(servers).length > 0;

            await prisma.mcpScan.create({
                data: {
                    target: 'auto-discovery',
                    status: 'success',
                    isMcp,
                    results: JSON.stringify({ servers, raw })
                }
            });

            return {
                isMcp,
                details: { servers, raw },
                rawOutput: stdout
            };
        } catch (e) {
            // If it's not valid JSON, it might just be text output
            await prisma.mcpScan.create({
                data: {
                    target: 'auto-discovery',
                    status: 'success',
                    isMcp: true,
                    results: undefined,
                    error: stdout
                }
            });

            return {
                isMcp: true,
                rawOutput: stdout
            };
        }
    } catch (error: any) {
        await prisma.mcpScan.create({
            data: {
                target: 'auto-discovery',
                status: 'error',
                isMcp: false,
                error: error.message
            }
        });

        return {
            isMcp: false,
            error: error.message,
            rawOutput: error.stdout
        };
    }
}

export async function runMcpScan(pathOrUrl: string): Promise<McpScanResult> {
    await requireOperatorOrSystem();
    const isUrl = pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://');
    let scanTarget = pathOrUrl;
    let tempConfigPath = '';

    try {
        if (isUrl) {
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');
            const tempDir = os.tmpdir();
            tempConfigPath = path.join(tempDir, `mcp-config-${Date.now()}.json`);

            const config = {
                mcpServers: {
                    [pathOrUrl]: {
                        url: pathOrUrl
                    }
                }
            };
            fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));
            scanTarget = tempConfigPath;
        }

        const { stdout, stderr } = await execFileAsync('mcp-scan', ['scan', '--json', scanTarget]);

        // Clean up temp file if created
        if (tempConfigPath) {
            const fs = await import('fs');
            try { fs.unlinkSync(tempConfigPath); } catch (e) { }
        }

        try {
            const { servers, raw } = normalizeMcpResults(stdout);
            const isMcp = Object.keys(servers).length > 0;

            await prisma.mcpScan.create({
                data: {
                    target: pathOrUrl,
                    status: 'success',
                    isMcp,
                    results: JSON.stringify({ servers, raw })
                }
            });

            return {
                url: pathOrUrl,
                isMcp,
                details: { servers, raw },
                rawOutput: stdout
            };
        } catch (e) {
            await prisma.mcpScan.create({
                data: {
                    target: pathOrUrl,
                    status: 'success',
                    isMcp: false,
                    error: stdout
                }
            });

            return {
                url: pathOrUrl,
                isMcp: false,
                rawOutput: stdout
            };
        }
    } catch (error: any) {
        // Clean up temp file if created
        if (tempConfigPath) {
            const fs = await import('fs');
            try { fs.unlinkSync(tempConfigPath); } catch (e) { }
        }

        // mcp-scan might exit with non-zero if vulnerabilities are found, we still want the JSON!
        if (error.stdout) {
            try {
                const parsed = JSON.parse(error.stdout);

                await prisma.mcpScan.create({
                    data: {
                        target: pathOrUrl,
                        status: 'success',
                        isMcp: true,
                        results: JSON.stringify(parsed)
                    }
                });

                return {
                    url: pathOrUrl,
                    isMcp: true,
                    details: parsed,
                    rawOutput: error.stdout
                };
            } catch (e) {
                // fallthrough
            }
        }

        await prisma.mcpScan.create({
            data: {
                target: pathOrUrl,
                status: 'error',
                isMcp: false,
                error: error.message
            }
        });

        return {
            url: pathOrUrl,
            isMcp: false,
            error: error.message,
            rawOutput: error.stdout
        };
    }
}

export interface SweepResult {
    url: string;
    isMcp: boolean;
    details?: {
        protocolVersion?: string;
        capabilities?: string[];
    };
    error?: string;
}

export async function sweepNetworkForMcp(subnet: string): Promise<SweepResult[]> {
    await requireOperatorOrSystem();
    const { Address4 } = await import('ip-address');

    let ipsToScan: string[] = [];

    // Support both direct IP or Subnet format
    if (subnet.includes('/')) {
        try {
            const address = new Address4(subnet) as any;
            const startStr = address.startAddress().bigInteger().toString();
            const endStr = address.endAddress().bigInteger().toString();

            const startAddress = BigInt(startStr);
            const endAddress = BigInt(endStr);

            // Generate all IPs in range
            for (let i = startAddress; i <= endAddress; i++) {
                ipsToScan.push(Address4.fromInteger(Number(i)).address);
            }
        } catch (e: any) {
            throw new Error(`Invalid CIDR subnet format or range: ${e.message}`);
        }
    } else {
        // Assume single comma-separated list
        ipsToScan = subnet.split(',').map(ip => ip.trim()).filter(Boolean);
    }

    if (ipsToScan.length === 0) {
        throw new Error("No valid IP addresses found to sweep.");
    }

    // Limit to /24 equivalent to prevent massive backend load
    if (ipsToScan.length > 256) {
        throw new Error("Target range is too large. Please limit to a /24 subnet (maximum 256 addresses) per sweep.");
    }

    // Common MCP Developer Ports
    const commonPorts = [3000, 3001, 5000, 8000, 8080];
    const checkEndpoints = ['/sse', '/v1/mcp'];

    const sweepPromises: Promise<SweepResult | null>[] = [];

    for (const ip of ipsToScan) {
        for (const port of commonPorts) {
            for (const endpoint of checkEndpoints) {

                const targetUrl = `http://${ip}:${port}${endpoint}`;

                // Fire and forget style checks with short timeout
                const probe = async (): Promise<SweepResult | null> => {
                    const controller = new AbortController();
                    // Extremely short timeout for sweeps to be fast
                    const timeoutId = setTimeout(() => controller.abort(), 1500);

                    try {
                        const res = await fetch(targetUrl, {
                            method: 'GET',
                            headers: { 'Accept': 'text/event-stream' },
                            signal: controller.signal
                        });

                        clearTimeout(timeoutId);

                        const contentType = res.headers.get('content-type');
                        const mcpVersion = res.headers.get('mcp-version') || res.headers.get('x-mcp-version');

                        // Usually MCP uses SSE or identifies itself
                        if (contentType?.includes('text/event-stream') || mcpVersion) {
                            return {
                                url: targetUrl,
                                isMcp: true,
                                details: {
                                    protocolVersion: mcpVersion || 'detected-via-sse',
                                    capabilities: ['sse-transport']
                                }
                            };
                        }
                    } catch (e) {
                        clearTimeout(timeoutId);
                        // Expected to fail for 99% of probes
                    }
                    return null;
                };

                sweepPromises.push(probe());
            }
        }
    }

    // Run all probes concurrently
    const results = await Promise.all(sweepPromises);

    // Filter out nulls (failed probes)
    const validResults = results.filter((r): r is SweepResult => r !== null);

    // De-duplicate in case both /sse and /v1/mcp responded on the same port
    const uniqueResults = new Map<string, SweepResult>();
    validResults.forEach(r => {
        // Use origin as key so we don't get both /sse and /mcp for the same server
        try {
            const origin = new URL(r.url).origin;
            if (!uniqueResults.has(origin)) {
                uniqueResults.set(origin, r);
            }
        } catch {
            uniqueResults.set(r.url, r);
        }
    });

    return Array.from(uniqueResults.values());
}

export async function getMcpHistory() {
    await requirePermission('DISCOVERY_VIEW');
    return prisma.mcpScan.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
    });
}
