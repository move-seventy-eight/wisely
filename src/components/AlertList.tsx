'use client';

import { useState } from 'react';
import { acknowledgeAlert } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, CheckCircle, AlertTriangle, ShieldAlert, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Alert {
    id: string;
    timestamp: Date;
    ruleId: string | null;
    requestId: string | null;
    severity: string;
    message: string;
    acknowledged: boolean;
}

export function AlertList({ initialAlerts }: { initialAlerts: Alert[] }) {
    const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);

    const handleAcknowledge = async (id: string) => {
        try {
            await acknowledgeAlert(id);
            setAlerts(alerts.filter(a => a.id !== id));
            toast.success('Alert acknowledged');
        } catch (e) {
            toast.error('Failed to acknowledge alert');
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
            case 'high': return <ShieldAlert className="h-5 w-5 text-orange-500" />;
            case 'medium': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            default: return <Bell className="h-5 w-5 text-blue-500" />;
        }
    };

    const getSeverityBg = (severity: string) => {
        switch (severity) {
            case 'critical': return 'border-red-500/30 bg-red-500/5';
            case 'high': return 'border-orange-500/30 bg-orange-500/5';
            case 'medium': return 'border-yellow-500/30 bg-yellow-500/5';
            default: return 'border-blue-500/30 bg-blue-500/5';
        }
    };

    return (
        <ScrollArea className="h-[400px]">
            {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mb-4 text-green-500 opacity-50" />
                    <p className="text-lg font-medium text-green-600">All Clear!</p>
                    <p className="text-sm">No pending alerts to review</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map((alert) => (
                        <div key={alert.id} className={`flex items-start justify-between p-4 rounded-lg border ${getSeverityBg(alert.severity)}`}>
                            <div className="flex items-start gap-4">
                                <div className="mt-0.5">
                                    {getSeverityIcon(alert.severity)}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={alert.severity === 'critical' || alert.severity === 'high' ? 'destructive' : 'secondary'}>
                                            {alert.severity.toUpperCase()}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(alert.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-sm">{alert.message}</p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAcknowledge(alert.id)}
                                className="shrink-0"
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Acknowledge
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </ScrollArea>
    );
}
