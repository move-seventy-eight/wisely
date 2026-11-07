'use server';

import { execFile } from 'child_process';
import util from 'util';
import prisma from './db';
import { requireOperatorOrSystem, requirePermission } from './auth';

const execFileAsync = util.promisify(execFile);

export interface AiSpotterResult {
    success: boolean;
    data?: any; // The JSON response from ai-detector
    error?: string;
}

export async function runAiSpotter(repoUrl: string, token?: string): Promise<AiSpotterResult> {
    await requireOperatorOrSystem();
    if (!repoUrl) {
        return { success: false, error: 'Repository URL is required.' };
    }

    // Basic validation to prevent immediate injection, though ai-detector handles URLs
    if (!repoUrl.startsWith('http://') && !repoUrl.startsWith('https://')) {
        return { success: false, error: 'Invalid repository URL. Must start with http:// or https://' };
    }

    let finalUrl = repoUrl;
    if (token) {
        finalUrl = repoUrl.replace(/^(https?:\/\/)/, `$1${encodeURIComponent(token)}@`);
    }

    try {
        // Run ai-detector binary directly with argument array (no shell interpolation)
        const { stdout, stderr } = await execFileAsync('ai-detector', ['--repo-url', finalUrl, '--output-format', 'json']);

        try {
            // Attempt to extract JSON from stdout in case there's preceding text
            const jsonStart = stdout.indexOf('{');
            const jsonEnd = stdout.lastIndexOf('}');

            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
                const data = JSON.parse(jsonStr);

                // Standardize: flatten detections_by_service into a findings array
                const findings: any[] = [];
                if (data.detections_by_service) {
                    Object.values(data.detections_by_service).forEach((serviceDetections: any) => {
                        if (Array.isArray(serviceDetections)) {
                            findings.push(...serviceDetections);
                        }
                    });
                }
                data.findings = findings;

                // Save to DB
                await prisma.spotterScan.create({
                    data: {
                        repoUrl: repoUrl,
                        status: 'success',
                        totalDetections: data.total_detections || 0,
                        servicesFound: JSON.stringify(data.services_found || []),
                        results: JSON.stringify(data),
                    }
                });

                return { success: true, data };
            } else {
                throw new Error("No JSON payload found in output");
            }
        } catch (parseError) {
            // If JSON parse fails, it might mean the repo had no AI deps, or ai-detector failed.
            // Usually ai-detector returns exit code 1 if it finds things, 0 if it doesn't.
            return { success: false, error: 'Failed to process spotter output: ' + stdout + '\n' + stderr };
        }

    } catch (error: any) {
        // ai-detector returns exit code 1 if it *finds* services. 
        // execAsync throws on non-zero exit codes. We must catch it and parse stdout still!
        if (error.stdout) {
            try {
                const jsonStart = error.stdout.indexOf('{');
                const jsonEnd = error.stdout.lastIndexOf('}');

                if (jsonStart !== -1 && jsonEnd !== -1) {
                    const jsonStr = error.stdout.substring(jsonStart, jsonEnd + 1);
                    const data = JSON.parse(jsonStr);

                    // Standardize: flatten detections_by_service into a findings array
                    const findings: any[] = [];
                    if (data.detections_by_service) {
                        Object.values(data.detections_by_service).forEach((serviceDetections: any) => {
                            if (Array.isArray(serviceDetections)) {
                                findings.push(...serviceDetections);
                            }
                        });
                    }
                    data.findings = findings;

                    // Save to DB
                    await prisma.spotterScan.create({
                        data: {
                            repoUrl: repoUrl,
                            status: 'success',
                            totalDetections: data.total_detections || 0,
                            servicesFound: JSON.stringify(data.services_found || []),
                            results: JSON.stringify(data),
                        }
                    });

                    return { success: true, data }; // Success meaning we scanned it and found stuff
                }
            } catch (e) {
                // Ignore parse error here, fallback to general error below
            }
        }

        // Save error to DB
        await prisma.spotterScan.create({
            data: {
                repoUrl: repoUrl,
                status: 'error',
                error: 'Execution failed or private repository access denied. Ensure your token is correct.'
            }
        });

        return {
            success: false,
            error: 'Execution failed or private repository access denied. Ensure your token is correct.'
        };
    }
}

export async function getSpotterHistory() {
    await requirePermission('DISCOVERY_VIEW');
    return prisma.spotterScan.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
    });
}
