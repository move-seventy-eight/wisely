import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert, Activity, Scan, Network, FileCode2, Terminal, Layers } from "lucide-react";

interface ActivityItem {
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: Date;
    metadata: any;
}

export function RecentActivity({ activities }: { activities: ActivityItem[] }) {
    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <Activity className="h-10 w-10 mb-2 opacity-50" />
                <p>No recent activity detected.</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-4">
                {activities.map((item) => (
                    <div key={item.id} className="flex gap-4 items-start p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
                        <div className="mt-1">
                            {item.type === 'workflow_risk' && <ShieldAlert className="h-5 w-5 text-red-500" />}
                            {item.type === 'new_service' && <Network className="h-5 w-5 text-blue-500" />}
                            {item.type === 'scan_complete' && <Scan className="h-5 w-5 text-green-500" />}
                            {item.type === 'spotter_scan' && <Activity className="h-5 w-5 text-blue-500" />}
                            {item.type === 'skill_scan' && <FileCode2 className="h-5 w-5 text-orange-500" />}
                            {item.type === 'mcp_scan' && <Terminal className="h-5 w-5 text-emerald-500" />}
                            {item.type === 'aibom_scan' && <Layers className="h-5 w-5 text-indigo-500" />}
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <p className="font-medium text-sm text-foreground">{item.title}</p>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {item.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}
