import { NextResponse } from 'next/server';
import { checkAndRunDueScans } from '@/lib/scheduled-scan-actions';
import { getCurrentUser } from '@/lib/auth';
import { getRolePermissions } from '@/lib/permissions';

export const dynamic = 'force-dynamic'; // Ensure it runs dynamically

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        const user = await getCurrentUser();
        const validCronSecret = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

        const userCanManageSchedules = user
            ? (await getRolePermissions(user.role)).includes('SCHEDULED_SCANS_MANAGE')
            : false;

        if (!validCronSecret && !userCanManageSchedules) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const results = await checkAndRunDueScans();

        return NextResponse.json({
            success: true,
            running: results.length,
            networkScans: results,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
