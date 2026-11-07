'use server'

import prisma from './db';
import { scanAction } from './scan-actions';
import { runAiSpotter } from './spotter-actions';
import { scanSkillGitRepo } from './skill-actions';
import { runMcpScan, sweepNetworkForMcp } from './mcp-actions';
import { requireOperatorOrSystem, requirePermission } from './auth';

// Get all scheduled scans
export async function getScheduledScans() {
    await requirePermission('SCHEDULED_SCANS_VIEW');
    return prisma.scheduledScan.findMany({
        orderBy: { createdAt: 'desc' }
    });
}

// Create a new scheduled scan
export async function createScheduledScan(data: {
    name: string;
    scanType: string;
    target: string;
    schedule: string;
    scanOptions?: string;
}) {
    await requireOperatorOrSystem('SCHEDULED_SCANS_MANAGE');
    const nextRun = calculateNextRun(data.schedule);

    return prisma.scheduledScan.create({
        data: {
            name: data.name,
            scanType: data.scanType,
            target: data.target,
            schedule: data.schedule,
            scanOptions: data.scanOptions || null,
            status: 'pending',
            nextRun
        }
    });
}

// Toggle scheduled scan enabled/disabled
export async function toggleScheduledScan(id: string) {
    await requireOperatorOrSystem('SCHEDULED_SCANS_MANAGE');
    const scan = await prisma.scheduledScan.findUnique({ where: { id } });
    if (!scan) throw new Error('Scheduled scan not found');

    return prisma.scheduledScan.update({
        where: { id },
        data: {
            enabled: !scan.enabled,
            nextRun: !scan.enabled ? calculateNextRun(scan.schedule) : null
        }
    });
}

// Delete a scheduled scan
export async function deleteScheduledScan(id: string) {
    await requireOperatorOrSystem('SCHEDULED_SCANS_MANAGE');
    return prisma.scheduledScan.delete({ where: { id } });
}

// Run a scheduled scan now — dispatches to the correct module
export async function runScheduledScanNow(id: string) {
    await requireOperatorOrSystem('SCHEDULED_SCANS_MANAGE');
    const scan = await prisma.scheduledScan.findUnique({ where: { id } });
    if (!scan) throw new Error('Scheduled scan not found');

    // Update status to running
    await prisma.scheduledScan.update({
        where: { id },
        data: { status: 'running' }
    });

    try {
        const options = scan.scanOptions ? JSON.parse(scan.scanOptions) : {};
        let resultSummary: any = {};

        switch (scan.scanType) {
            case 'network': {
                const results = await scanAction(scan.target);
                resultSummary = {
                    type: 'network',
                    timestamp: new Date().toISOString(),
                    servicesFound: results.length,
                    services: results.map(r => ({ ip: r.ip, port: r.port, service: r.service }))
                };

                // Persistence handled in scanAction (it creates ScanResult/Service)
                break;
            }

            case 'ai_spotter': {
                const result = await runAiSpotter(scan.target, options.token);
                resultSummary = {
                    type: 'ai_spotter',
                    timestamp: new Date().toISOString(),
                    success: result.success,
                    totalDetections: result.data?.total_detections || 0,
                    servicesFound: result.data?.services_found || [],
                    error: result.error
                };

                // Persist to SpotterScan
                await prisma.spotterScan.create({
                    data: {
                        repoUrl: scan.target,
                        status: result.success ? 'success' : 'error',
                        totalDetections: resultSummary.totalDetections,
                        servicesFound: JSON.stringify(resultSummary.servicesFound),
                        results: result.data ? JSON.stringify(result.data) : null,
                        error: result.error || null
                    }
                });
                break;
            }

            case 'skill_scanner': {
                const result = await scanSkillGitRepo(scan.target, {
                    behavioral: options.behavioral ?? true,
                    llm: options.llm ?? false,
                    trigger: options.trigger ?? false,
                    token: options.token
                });
                const findingsCount = result.details?.findings?.length || 0;
                resultSummary = {
                    type: 'skill_scanner',
                    timestamp: new Date().toISOString(),
                    success: result.success,
                    findingsCount,
                    skillsScanned: result.details?.skills_scanned || [],
                    error: result.error
                };

                // Persist to SkillScan
                await prisma.skillScan.create({
                    data: {
                        target: scan.target,
                        status: result.success ? 'success' : 'error',
                        hasFindings: findingsCount > 0,
                        findingsCount,
                        results: result.details ? JSON.stringify(result.details) : null,
                        error: result.error || null
                    }
                });
                break;
            }

            case 'mcp_scanner': {
                let isMcp = false;
                let details = null;
                let error = null;

                if (options.sweep && options.subnet) {
                    const results = await sweepNetworkForMcp(options.subnet);
                    resultSummary = {
                        type: 'mcp_scanner',
                        timestamp: new Date().toISOString(),
                        success: true,
                        endpointsFound: results.filter(r => r.isMcp).length,
                        totalScanned: results.length,
                        mcpEndpoints: results.filter(r => r.isMcp).map(r => r.url)
                    };
                    // Sweep doesn't currently have a dedicated persistence table, 
                    // but individual results are NOT being saved here yet.
                    // (Sweeping is usually ephemeral in this app)
                } else {
                    const result = await runMcpScan(scan.target);
                    isMcp = result.isMcp ?? false;
                    details = result.details;
                    error = result.error;

                    resultSummary = {
                        type: 'mcp_scanner',
                        timestamp: new Date().toISOString(),
                        success: !error,
                        isMcp,
                        details,
                        error
                    };

                    // Persist to McpScan
                    await prisma.mcpScan.create({
                        data: {
                            target: scan.target,
                            status: error ? 'error' : 'success',
                            isMcp,
                            results: details ? JSON.stringify(details) : null,
                            error: error || null
                        }
                    });
                }
                break;
            }

            default:
                throw new Error(`Unknown scan type: ${scan.scanType}`);
        }

        // Calculate next run time
        const nextRun = scan.schedule === 'once' ? null : calculateNextRun(scan.schedule);

        // Update with results
        await prisma.scheduledScan.update({
            where: { id },
            data: {
                status: 'completed',
                lastRun: new Date(),
                nextRun,
                lastResult: JSON.stringify(resultSummary)
            }
        });

        return { success: true, result: resultSummary };
    } catch (error: any) {
        const nextRun = scan.schedule === 'once' ? null : calculateNextRun(scan.schedule);

        await prisma.scheduledScan.update({
            where: { id },
            data: {
                status: 'failed',
                lastRun: new Date(),
                nextRun,
                lastResult: JSON.stringify({ error: error.message })
            }
        });

        throw error;
    }
}

// Check and run due scheduled scans (called by cron)
export async function checkAndRunDueScans() {
    await requireOperatorOrSystem('SCHEDULED_SCANS_MANAGE');
    const now = new Date();

    const dueScans = await prisma.scheduledScan.findMany({
        where: {
            enabled: true,
            status: { not: 'running' },
            nextRun: { lte: now }
        }
    });

    const results = [];

    for (const scan of dueScans) {
        try {
            const result = await runScheduledScanNow(scan.id);
            results.push({ id: scan.id, name: scan.name, scanType: scan.scanType, ...result });
        } catch (error: any) {
            results.push({ id: scan.id, name: scan.name, scanType: scan.scanType, success: false, error: error.message });
        }
    }

    return results;
}

// Calculate next run time based on schedule
function calculateNextRun(schedule: string): Date | null {
    const now = new Date();

    switch (schedule) {
        case 'once':
            return new Date(now.getTime() + 1000);
        case 'hourly':
            return new Date(now.getTime() + 60 * 60 * 1000);
        case 'daily':
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        case 'weekly':
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        default:
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
}
