import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getN8nStatusAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const status = await getN8nStatusAction();
        return NextResponse.json(status);
    } catch (error) {
        console.error('API /api/n8n/health error:', error);
        return NextResponse.json({
            connected: false,
            status: 'offline',
            title: 'n8n Disconnected',
            description: 'Health check failed'
        });
    }
}
