'use server';

import { execFile } from 'child_process';
import util from 'util';
import prisma from './db';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { requireOperatorOrSystem, requirePermission } from './auth';

const execFileAsync = util.promisify(execFile);

export interface AibomResult {
    success: boolean;
    data?: any;
    error?: string;
}

export async function runAibomScan(target: string, token?: string): Promise<AibomResult> {
    await requireOperatorOrSystem();
    if (!target) {
        return { success: false, error: 'Target URL or path is required.' };
    }

    const isUrl = target.startsWith('http://') || target.startsWith('https://');
    let scanPath = target;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aibom-scan-'));

    try {
        if (isUrl) {
            let cloneUrl = target;
            if (token) {
                cloneUrl = target.replace(/^(https?:\/\/)/, `$1${encodeURIComponent(token)}@`);
            }
            // Clone the repo deeply enough to find the code, depth 1 is usually sufficient, but we might miss submodules.
            await execFileAsync('git', ['clone', '--depth', '1', cloneUrl, tempDir]);
            scanPath = tempDir;
        }

        const outJsonPath = path.join(tempDir, 'aibom-result.json');

        // Path to the installed cisco-aibom outside the project root to prevent Next.js build errors
        const aibomCmd = path.join(os.homedir(), '.wisely-scanners/aibom/venv/bin/cisco-aibom');
        const dbPath = path.join(os.homedir(), '.aibom/catalogs/aibom_catalog-0.3.0.duckdb');

        try {
            await execFileAsync(aibomCmd, ['analyze', scanPath, '--output-format', 'json', '--output-file', outJsonPath], {
                env: { ...process.env, AIBOM_DB_PATH: dbPath }
            });
        } catch (e: any) {
            // Check if the output file was created anyway (some errors are partial)
            try {
                await fs.access(outJsonPath);
            } catch {
                throw new Error(`AIBOM analysis failed and no result file was generated: ${e.message || String(e)}`);
            }
        }

        const resultStr = await fs.readFile(outJsonPath, 'utf8');
        const data = JSON.parse(resultStr);

        const summary = data?.aibom_analysis?.summary || {};
        const totalComponents = summary?.total_components || 0;

        await prisma.aibomScan.create({
            data: {
                target: target,
                status: 'success',
                totalComponents: totalComponents,
                results: JSON.stringify(data),
            }
        });

        return { success: true, data };

    } catch (error: any) {
        await prisma.aibomScan.create({
            data: {
                target: target,
                status: 'error',
                totalComponents: 0,
                error: error.message || String(error),
            }
        });
        return { success: false, error: 'Failed to process AIBOM scan: ' + (error.message || String(error)) };
    } finally {
        if (isUrl) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error("Cleanup failed:", cleanupError);
            }
        }
    }
}

export async function getAibomHistory(): Promise<any[]> {
    await requirePermission('DISCOVERY_VIEW');
    try {
        return await prisma.aibomScan.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    } catch (error) {
        console.error("Failed to fetch AIBOM history:", error);
        return [];
    }
}
