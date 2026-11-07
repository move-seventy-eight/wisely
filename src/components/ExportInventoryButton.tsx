'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import type { CiscoModelScoreMatch } from '@/lib/cisco-leaderboard';

interface ComponentItem {
    category: string;
    service: string;
    nodeName: string;
    nodeType: string;
    workflowName: string;
    workflowId: string;
    environment: string;
    model?: string;
    modelScore?: CiscoModelScoreMatch | null;
    workflowRiskScore?: number;
    workflowActive?: boolean;
}

export function ExportInventoryButton({ items }: { items: ComponentItem[] }) {
    const handleExport = () => {
        try {
            const headers = [
                'Category',
                'Service',
                'Model',
                'Cisco Combined Score',
                'Cisco Single-Turn',
                'Cisco Multi-Turn',
                'Cisco Rank',
                'Node Name',
                'Node Type',
                'Environment',
                'Workflow Name',
                'Workflow ID',
                'Workflow Active',
                'Workflow Risk Score',
            ];

            // Format CSV, handling quotes
            const csvRows = [
                headers.join(','),
                ...items.map(item => [
                    `"${item.category.replace(/"/g, '""')}"`,
                    `"${item.service.replace(/"/g, '""')}"`,
                    `"${(item.model || '').replace(/"/g, '""')}"`,
                    item.modelScore?.combined_score.toFixed(1) || '',
                    item.modelScore?.validation_score.toFixed(1) || '',
                    item.modelScore?.multi_turn_resistance.toFixed(1) || '',
                    item.modelScore?.rank || '',
                    `"${item.nodeName.replace(/"/g, '""')}"`,
                    `"${item.nodeType.replace(/"/g, '""')}"`,
                    `"${item.environment.replace(/"/g, '""')}"`,
                    `"${item.workflowName.replace(/"/g, '""')}"`,
                    `"${item.workflowId.replace(/"/g, '""')}"`,
                    item.workflowActive ? 'Yes' : 'No',
                    item.workflowRiskScore ?? '',
                ].join(','))
            ];

            const csvContent = csvRows.join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `workflow-inventory-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('Inventory exported successfully');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export inventory');
        }
    };

    return (
        <Button variant="outline" className="gap-2 shrink-0" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
        </Button>
    );
}
