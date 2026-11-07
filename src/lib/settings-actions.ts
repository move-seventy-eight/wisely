'use server'

import prisma from './db';
import { revalidatePath } from 'next/cache';
import { CustomPattern } from './secret-scanner';
import { requirePermission } from './auth';

const CUSTOM_PATTERNS_KEY = 'custom_secret_patterns';

export async function getSystemSettings() {
    await requirePermission('SETTINGS_MANAGE');
    const settings = await prisma.systemSetting.findMany();
    const dbSettings = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
    }, {} as Record<string, string>);

    // Merge with env vars (DB takes precedence if set, otherwise Env, otherwise default)
    return {
        N8N_BASE_URL: dbSettings.N8N_BASE_URL || process.env.N8N_BASE_URL || '',
        N8N_API_KEY: dbSettings.N8N_API_KEY || process.env.N8N_API_KEY || '',
        OLLAMA_BASE_URL: dbSettings.OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        OPENAI_API_KEY: dbSettings.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
        ANTHROPIC_API_KEY: dbSettings.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '',
        ...dbSettings
    };
}

export async function saveSystemSetting(key: string, value: string, isSecret: boolean = false) {
    await requirePermission('SETTINGS_MANAGE');
    try {
        await prisma.systemSetting.upsert({
            where: { key },
            update: { value, isSecret },
            create: { key, value, isSecret }
        });
        revalidatePath('/red-team');
        return { success: true };
    } catch (error) {
        console.error("Failed to save setting:", error);
        return { success: false, error: 'Failed to save setting' };
    }
}

export async function getGlobalCustomPatterns(): Promise<CustomPattern[]> {
    try {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: CUSTOM_PATTERNS_KEY }
        });

        if (setting && setting.value) {
            return JSON.parse(setting.value) as CustomPattern[];
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch global custom patterns:", error);
        return [];
    }
}

export async function saveGlobalCustomPatterns(patterns: CustomPattern[]): Promise<{ success: boolean, error?: string }> {
    await requirePermission('DISCOVERY_RUN');
    try {
        await prisma.systemSetting.upsert({
            where: { key: CUSTOM_PATTERNS_KEY },
            update: { value: JSON.stringify(patterns), updatedAt: new Date() },
            create: {
                key: CUSTOM_PATTERNS_KEY,
                value: JSON.stringify(patterns),
                description: 'Global custom regex patterns for secret scanning',
                isSecret: false
            }
        });
        revalidatePath('/scanner-settings'); // Revalidate global scanner page
        revalidatePath('/workflows'); // Revalidate workflows which show executions
        return { success: true };
    } catch (error: any) {
        console.error("Failed to save global custom patterns:", error);
        return { success: false, error: error.message };
    }
}
