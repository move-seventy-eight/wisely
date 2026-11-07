'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShieldAlert, AlertTriangle, Eye, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type FlaggedRequest = {
    id: string;
    timestamp: string;
    sourceIp: string;
    targetIp: string;
    targetPort: number;
    provider: string | null;
    model: string | null;
    promptPreview: string | null;
    responsePreview: string | null;
    riskScore: number;
    isFlagged: boolean;
    flags: string | null;
};

export function FlaggedPrompts({ requests }: { requests: FlaggedRequest[] }) {
    const [selectedRequest, setSelectedRequest] = useState<FlaggedRequest | null>(null);

    const getSeverityColor = (score: number) => {
        if (score >= 80) return 'bg-red-500';
        if (score >= 50) return 'bg-orange-500';
        return 'bg-yellow-500';
    };

    const getSeverityLabel = (score: number) => {
        if (score >= 80) return 'Critical';
        if (score >= 50) return 'High';
        return 'Medium';
    };

    const parseFlags = (flags: string | null): string[] => {
        if (!flags) return [];
        try {
            return JSON.parse(flags);
        } catch {
            return [];
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    return (
        <>
            <ScrollArea className="h-[500px]">
                {requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                        <ShieldAlert className="h-12 w-12 mb-4 opacity-20" />
                        <p>No flagged prompts detected</p>
                        <p className="text-sm">High-risk requests will appear here</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {requests.map((req) => (
                            <div
                                key={req.id}
                                className="p-4 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors cursor-pointer"
                                onClick={() => setSelectedRequest(req)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="mt-1 h-10 w-10 rounded-full flex items-center justify-center bg-red-500/10">
                                            <AlertTriangle className="h-5 w-5 text-red-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium">{req.provider || 'Unknown Provider'}</span>
                                                {req.model && (
                                                    <Badge variant="outline" className="text-xs">{req.model}</Badge>
                                                )}
                                                <Badge className={`text-xs text-white ${getSeverityColor(req.riskScore)}`}>
                                                    {getSeverityLabel(req.riskScore)}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {req.sourceIp} → {req.targetIp}:{req.targetPort}
                                            </p>
                                            {req.promptPreview && (
                                                <p className="text-sm mt-2 p-2 bg-background/50 rounded border border-border truncate">
                                                    "{req.promptPreview}..."
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {parseFlags(req.flags).map((flag, i) => (
                                                    <Badge key={i} variant="secondary" className="text-xs">
                                                        {flag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="text-2xl font-bold text-red-500">
                                            {req.riskScore}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(req.timestamp).toLocaleString()}
                                        </span>
                                        <Button size="sm" variant="ghost" className="gap-1">
                                            <Eye className="h-3 w-3" />
                                            Details
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Detail Modal */}
            <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Flagged Request Details
                        </DialogTitle>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4">
                            {/* Meta Info */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Provider:</span>
                                    <span className="ml-2 font-medium">{selectedRequest.provider || 'Unknown'}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Model:</span>
                                    <span className="ml-2 font-medium">{selectedRequest.model || 'Unknown'}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Source:</span>
                                    <span className="ml-2 font-mono">{selectedRequest.sourceIp}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Target:</span>
                                    <span className="ml-2 font-mono">{selectedRequest.targetIp}:{selectedRequest.targetPort}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Time:</span>
                                    <span className="ml-2">{new Date(selectedRequest.timestamp).toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Risk Score:</span>
                                    <span className="ml-2 font-bold text-red-500">{selectedRequest.riskScore}/100</span>
                                </div>
                            </div>

                            {/* Detected Issues */}
                            <div>
                                <h4 className="font-medium mb-2">Detected Issues</h4>
                                <div className="flex flex-wrap gap-2">
                                    {parseFlags(selectedRequest.flags).map((flag, i) => (
                                        <Badge key={i} variant="destructive">{flag}</Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Prompt Preview */}
                            {selectedRequest.promptPreview && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-medium">Prompt Preview</h4>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => copyToClipboard(selectedRequest.promptPreview || '')}
                                        >
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copy
                                        </Button>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm">
                                        {selectedRequest.promptPreview}
                                    </div>
                                </div>
                            )}

                            {/* Response Preview */}
                            {selectedRequest.responsePreview && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-medium">Response Preview</h4>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => copyToClipboard(selectedRequest.responsePreview || '')}
                                        >
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copy
                                        </Button>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm">
                                        {selectedRequest.responsePreview}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
