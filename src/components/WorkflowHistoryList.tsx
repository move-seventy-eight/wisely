'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { History } from 'lucide-react';
import { DiffViewer } from './DiffViewer';

interface HistoryItem {
    id: string; // Changed from number to string to match Prisma
    version: number;
    nodes: string;
    connections: string;
    createdAt: Date;
}

interface WorkflowHistoryListProps {
    history: HistoryItem[];
    currentNodes: any; // Fallback if comparing with current
}

export function WorkflowHistoryList({ history, currentNodes }: WorkflowHistoryListProps) {
    const [selectedDiff, setSelectedDiff] = useState<{ old: any, new: any, version: number } | null>(null);

    const handleViewDiff = (version: HistoryItem, index: number) => {
        // Find previous version. If this is the oldest, compare with empty or null?
        // Or if this is the latest in list (which is index 0 usually as it's desc), compare with index 1

        // Actually, history is usually ordered DESC (latest first)
        // So 'previous' version is at index + 1

        const currentData = JSON.parse(version.nodes);
        const previousItem = history[index + 1];
        const previousData = previousItem ? JSON.parse(previousItem.nodes) : {}; // Default to empty if first version

        setSelectedDiff({
            old: previousData,
            new: currentData,
            version: version.version
        });
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Version History</CardTitle>
                    <CardDescription>Previous versions of this workflow</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {history.map((version, index) => (
                            <div key={version.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                <div className="flex items-center gap-4">
                                    <History className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <p className="font-medium">Version {version.version}</p>
                                        <p className="text-xs text-muted-foreground">{new Date(version.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleViewDiff(version, index)}
                                >
                                    View Diff
                                </Button>
                            </div>
                        ))}
                        {history.length === 0 && (
                            <p className="text-sm text-muted-foreground">No history available.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {selectedDiff && (
                <DiffViewer
                    isOpen={!!selectedDiff}
                    onClose={() => setSelectedDiff(null)}
                    oldData={selectedDiff.old}
                    newData={selectedDiff.new}
                    version={selectedDiff.version}
                />
            )}
        </>
    );
}
