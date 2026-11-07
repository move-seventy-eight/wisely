'use client';

import { Button } from '@/components/ui/button';
import { FileJson } from 'lucide-react';

export function DownloadWorkflowButton({ workflow }: { workflow: any }) {
    const handleDownload = () => {
        // Construct a full representation similar to what n8n exports
        const exportData = {
            name: workflow.name,
            nodes: typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes,
            connections: typeof workflow.connections === 'string' ? JSON.parse(workflow.connections) : workflow.connections,
            active: workflow.active,
            settings: {},
            id: workflow.id
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `wf_${workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    return (
        <Button variant="ghost" size="sm" onClick={handleDownload} className="hover:bg-primary/10 hover:text-primary gap-2" title="Export Raw JSON">
            <FileJson className="h-4 w-4" />
        </Button>
    );
}
