'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Pause, RefreshCw, ShieldAlert, CheckCircle2, Activity, Zap } from 'lucide-react';

type LLMRequest = {
    id: string;
    timestamp: string;
    sourceIp: string;
    targetIp: string;
    targetPort: number;
    provider: string | null;
    model: string | null;
    promptPreview: string | null;
    riskScore: number;
    isFlagged: boolean;
};

export function LiveFeed() {
    const [requests, setRequests] = useState<LLMRequest[]>([]);
    const [isLive, setIsLive] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchLiveFeed = async () => {
        try {
            const since = new Date(Date.now() - 60000).toISOString(); // Last 60 seconds
            const res = await fetch(`/api/shadow-ai/live?since=${since}&limit=20`);
            const data = await res.json();

            if (data.success && data.data) {
                // Merge new requests, avoid duplicates
                setRequests(prev => {
                    const existingIds = new Set(prev.map(r => r.id));
                    const newRequests = data.data.filter((r: LLMRequest) => !existingIds.has(r.id));
                    const merged = [...newRequests, ...prev].slice(0, 50); // Keep last 50
                    return merged;
                });
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error('Failed to fetch live feed:', error);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchLiveFeed();

        // Set up polling when live
        if (isLive) {
            intervalRef.current = setInterval(fetchLiveFeed, 3000); // Poll every 3 seconds
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isLive]);

    const toggleLive = () => {
        setIsLive(!isLive);
    };

    const getRiskColor = (score: number) => {
        if (score >= 70) return 'text-red-500 bg-red-500/10 border-red-500/30';
        if (score >= 40) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
        return 'text-green-500 bg-green-500/10 border-green-500/30';
    };

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Badge variant={isLive ? 'default' : 'secondary'} className="gap-1">
                        {isLive ? <Zap className="h-3 w-3 animate-pulse" /> : <Pause className="h-3 w-3" />}
                        {isLive ? 'Live' : 'Paused'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        Last update: {lastUpdate.toLocaleTimeString()}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={fetchLiveFeed}>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                    </Button>
                    <Button size="sm" variant={isLive ? 'destructive' : 'default'} onClick={toggleLive}>
                        {isLive ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                        {isLive ? 'Pause' : 'Resume'}
                    </Button>
                </div>
            </div>

            {/* Live Feed */}
            <ScrollArea className="h-[500px]">
                {requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                        <Activity className="h-12 w-12 mb-4 opacity-20 animate-pulse" />
                        <p>Waiting for LLM requests...</p>
                        <p className="text-sm">Requests will appear here in real-time</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {requests.map((req, index) => (
                            <div
                                key={req.id}
                                className={`p-4 rounded-lg border transition-all ${index === 0 && isLive ? 'animate-in slide-in-from-top-2 duration-300' : ''
                                    } ${req.isFlagged ? 'border-red-500/30 bg-red-500/5' : 'bg-card'}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center ${req.isFlagged ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                                            {req.isFlagged ? (
                                                <ShieldAlert className="h-4 w-4 text-red-500" />
                                            ) : (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{req.provider || 'Unknown'}</span>
                                                {req.model && (
                                                    <Badge variant="outline" className="text-xs">{req.model}</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {req.sourceIp} → {req.targetIp}:{req.targetPort}
                                            </p>
                                            {req.promptPreview && (
                                                <p className="text-sm text-muted-foreground mt-1 truncate max-w-md">
                                                    "{req.promptPreview}..."
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className={`px-2 py-1 text-xs font-medium rounded border ${getRiskColor(req.riskScore)}`}>
                                            Risk: {req.riskScore}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(req.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
