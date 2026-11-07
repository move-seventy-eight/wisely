import { NextRequest, NextResponse } from 'next/server';
import { getLiveFeed } from '@/lib/data-source-actions';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        if (!await getCurrentUser()) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const sinceParam = searchParams.get('since');
        const limitParam = searchParams.get('limit');

        const since = sinceParam ? new Date(sinceParam) : undefined;
        const limit = limitParam ? parseInt(limitParam) : 50;

        const requests = await getLiveFeed(since, limit);

        return NextResponse.json({
            success: true,
            count: requests.length,
            data: requests,
            timestamp: new Date().toISOString()
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch live feed';
        console.error('Live feed error:', error);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
