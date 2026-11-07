import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function UnauthorizedPage() {
    return (
        <div className="flex min-h-[70vh] items-center justify-center">
            <Card className="w-full max-w-lg text-center">
                <CardContent className="space-y-5 p-10">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600"><ShieldX className="h-7 w-7" /></div>
                    <div><h1 className="text-2xl font-bold">Access denied</h1><p className="mt-2 text-muted-foreground">Your role does not have permission to access this feature.</p></div>
                    <Button asChild><Link href="/">Return to overview</Link></Button>
                </CardContent>
            </Card>
        </div>
    );
}
