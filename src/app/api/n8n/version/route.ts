import { NextResponse } from 'next/server';
import { fetchN8nVersion } from '@/lib/n8n';
import { getCurrentUser } from '@/lib/auth';
import { getRolePermissions } from '@/lib/permissions';

export async function POST(req: Request) {
    try {
        const user = await getCurrentUser();
        const canManageSettings = user
            ? (await getRolePermissions(user.role)).includes('SETTINGS_MANAGE')
            : false;
        if (!canManageSettings) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = await req.json();
        const { baseUrl } = body;

        if (!baseUrl) {
            return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
        }

        const version = await fetchN8nVersion({ baseUrl, apiKey: '' });

        return NextResponse.json({ version });
    } catch (error) {
        console.error('API /api/n8n/version error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
