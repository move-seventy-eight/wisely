'use server';

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import prisma from './db';
import { requireOperatorOrSystem, requirePermission } from './auth';

const execFileAsync = promisify(execFile);

export interface SkillScanResult {
    path?: string;
    success?: boolean;
    details?: any; // The parsed JSON from skill-scanner
    error?: string;
    rawOutput?: string;
}

export async function runSkillScan(
    path: string,
    options: {
        behavioral?: boolean;
        llm?: boolean;
        trigger?: boolean;
    } = {}
): Promise<SkillScanResult> {
    await requireOperatorOrSystem();
    try {
        const args = ['scan', path, '--format', 'json'];

        if (options.behavioral) args.push('--use-behavioral');
        if (options.llm) args.push('--use-llm');
        if (options.trigger) args.push('--use-trigger');

        const { stdout, stderr } = await execFileAsync('skill-scanner', args);

        try {
            const parsed = JSON.parse(stdout);
            return {
                path,
                success: true,
                details: parsed,
                rawOutput: stdout
            };
        } catch (e) {
            return {
                path,
                success: true,
                rawOutput: stdout
            };
        }
    } catch (error: any) {
        // CLI often exits with code 1 if findings are discovered (with --fail-on-findings or by default depending on version)
        if (error.stdout) {
            try {
                // If it outputs valid json even on failure, parse it
                const parsed = JSON.parse(error.stdout);
                return {
                    path,
                    success: true,
                    details: parsed,
                    rawOutput: error.stdout
                };
            } catch (e) {
                // Fallthrough to regular error handling
            }
        }

        return {
            path,
            success: false,
            error: error.message,
            rawOutput: error.stdout || error.stderr
        };
    }
}

export async function uploadAndScanSkill(
    formData: FormData,
    options: {
        behavioral?: boolean;
        llm?: boolean;
        trigger?: boolean;
    } = {}
): Promise<SkillScanResult> {
    await requireOperatorOrSystem();
    const file = formData.get('file') as File | null;
    if (!file) {
        return { success: false, error: 'No file uploaded' };
    }

    const tmpDir = os.tmpdir();
    const uniqueId = crypto.randomUUID();
    const workDir = path.join(tmpDir, `skill-scan-${uniqueId}`);

    try {
        await fs.mkdir(workDir, { recursive: true });

        const isZip = file.name.endsWith('.zip');
        const fileName = isZip ? 'upload.zip' : (file.name.endsWith('.md') ? file.name : 'SKILL.md');
        const filePath = path.join(workDir, fileName);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        await fs.writeFile(filePath, buffer);

        let targetPath = workDir;

        if (isZip) {
            // Extract the zip in the workDir with execFile (safe argument array)
            await execFileAsync('unzip', ['-q', filePath, '-d', workDir]);
            // Optionally delete the zip so it doesn't get scanned itself (though probably safe)
            await fs.unlink(filePath).catch(() => { });
        }

        const result = await runSkillScan(targetPath, options);

        // Strip out the ugly temp path from the result for better UI
        if (result.path) {
            result.path = file.name; // Display original file name instead of /tmp/uuid...
        }

        // Hide absolute paths inside findings
        if (result.details && result.details.findings) {
            result.details.findings.forEach((f: any) => {
                if (f.file_path && f.file_path.includes(uniqueId)) {
                    f.file_path = f.file_path.split(uniqueId)[1].replace(/^\//, ''); // Get relative part
                }
            });
        }

        // Save to DB
        await prisma.skillScan.create({
            data: {
                target: result.path || 'Unknown File',
                status: result.success ? 'success' : 'error',
                hasFindings: Array.isArray(result.details?.findings) && result.details.findings.length > 0,
                findingsCount: Array.isArray(result.details?.findings) ? result.details.findings.length : 0,
                results: result.details ? JSON.stringify(result.details) : undefined,
                error: result.error
            }
        });

        return result;

    } catch (error: any) {
        // Save error to DB
        await prisma.skillScan.create({
            data: {
                target: file.name,
                status: 'error',
                error: error.message
            }
        });

        return {
            success: false,
            error: error.message
        };
    } finally {
        // Cleanup temp directory
        try {
            await fs.rm(workDir, { recursive: true, force: true });
        } catch (e) {
            console.error(`Failed to cleanup temp dir ${workDir}:`, e);
        }
    }
}

export async function scanSkillGitRepo(
    repoUrl: string,
    options: {
        behavioral?: boolean;
        llm?: boolean;
        trigger?: boolean;
        token?: string;
    } = {}
): Promise<SkillScanResult> {

    await requireOperatorOrSystem();

    // Basic validation
    if (!repoUrl.startsWith('http://') && !repoUrl.startsWith('https://')) {
        return { success: false, error: 'Invalid Git URL provided. Must start with http:// or https://' };
    }

    const tmpDir = os.tmpdir();
    const uniqueId = crypto.randomUUID();
    const workDir = path.join(tmpDir, `skill-git-${uniqueId}`);

    let finalUrl = repoUrl;
    if (options.token) {
        finalUrl = repoUrl.replace(/^(https?:\/\/)/, `$1${encodeURIComponent(options.token)}@`);
    }

    try {
        await fs.mkdir(workDir, { recursive: true });

        // Clone the repository (depth 1 to be fast) using execFile
        await execFileAsync('git', ['clone', '--depth', '1', finalUrl, workDir]);

        // Check if root has SKILL.md — if not, recursively find all SKILL.md files (multi-skill repo)
        let scanTargets: { dir: string; name: string }[] = [];
        try {
            await fs.access(path.join(workDir, 'SKILL.md'));
            scanTargets.push({ dir: workDir, name: 'root' });
        } catch {
            // No root SKILL.md — search for SKILL.md files
            try {
                const { stdout: findOutput } = await execFileAsync('find', [
                    workDir,
                    '-name',
                    'SKILL.md',
                    '-not',
                    '-path',
                    '*/node_modules/*',
                    '-not',
                    '-path',
                    '*/.git/*'
                ]);
                const skillFiles = findOutput.trim().split('\n').filter(Boolean);
                for (const skillFile of skillFiles) {
                    const skillDir = path.dirname(skillFile);
                    const relativePath = path.relative(workDir, skillDir);
                    const skillName = relativePath || 'root';
                    scanTargets.push({ dir: skillDir, name: skillName });
                }
            } catch {
                // find command failed, fall through
            }
        }

        if (scanTargets.length === 0) {
            // Last resort: scan root anyway (might yield useful output or a clearer error)
            scanTargets.push({ dir: workDir, name: 'root' });
        }

        // Scan each target and merge results
        let allFindings: any[] = [];
        let allRawOutput = '';
        let hasError = false;
        let lastError = '';

        for (const target of scanTargets) {
            const result = await runSkillScan(target.dir, options);
            if (result.rawOutput) allRawOutput += `\n--- ${target.name} ---\n${result.rawOutput}`;
            if (result.details?.findings) {
                const findings = result.details.findings.map((f: any) => ({
                    ...f,
                    skill_name: target.name,
                    file_path: f.file_path
                        ? f.file_path.replace(workDir + '/', '').replace(workDir, '')
                        : undefined
                }));
                allFindings.push(...findings);
            }
            if (!result.success) {
                hasError = true;
                lastError = result.error || '';
            }
        }

        const aggregatedResult: SkillScanResult = {
            path: repoUrl,
            success: !hasError || allFindings.length > 0,
            details: {
                findings: allFindings,
                skills_scanned: scanTargets.map(t => t.name),
                total_skills: scanTargets.length,
            },
            rawOutput: allRawOutput,
            error: hasError && allFindings.length === 0 ? lastError : undefined
        };

        // Hide absolute paths inside findings
        if (aggregatedResult.details?.findings) {
            aggregatedResult.details.findings.forEach((f: any) => {
                if (f.file_path && f.file_path.includes(uniqueId)) {
                    f.file_path = f.file_path.split(uniqueId)[1].replace(/^\//, '');
                }
            });
        }

        // Save to DB
        await prisma.skillScan.create({
            data: {
                target: aggregatedResult.path || repoUrl,
                status: aggregatedResult.success ? 'success' : 'error',
                hasFindings: allFindings.length > 0,
                findingsCount: allFindings.length,
                results: aggregatedResult.details ? JSON.stringify(aggregatedResult.details) : undefined,
                error: aggregatedResult.error
            }
        });

        return aggregatedResult;

    } catch (error: any) {
        await prisma.skillScan.create({
            data: {
                target: repoUrl,
                status: 'error',
                error: 'Failed to clone repository or run scan. If this is a private repository, ensure your token is correct.'
            }
        });

        return {
            success: false,
            error: 'Failed to clone repository or run scan. If this is a private repository, ensure your token is correct.'
        };
    } finally {
        // Cleanup temp clone directory
        try {
            await fs.rm(workDir, { recursive: true, force: true });
        } catch (e) {
            console.error(`Failed to cleanup git dir ${workDir}:`, e);
        }
    }
}

export async function getSkillHistory() {
    await requirePermission('DISCOVERY_VIEW');
    return prisma.skillScan.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
    });
}
