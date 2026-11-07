'use client';

import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { generateSecurityReport } from '@/lib/pdf-generator';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';

interface ExportReportButtonProps {
    workflow: {
        id: string;
        name: string;
        active: boolean;
        riskScore: number;
        nodes: string;
        securityIssues: string | null;
    };
    n8nBaseUrl?: string;
}

export function ExportReportButton({ workflow, n8nBaseUrl }: ExportReportButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleExport = async () => {
        setIsGenerating(true);
        try {
            const nodes = JSON.parse(workflow.nodes || '[]');
            const issues = JSON.parse(workflow.securityIssues || '[]');

            let diagramImage = null;
            const container = document.getElementById('workflow-visualizer-canvas');
            if (container) {
                try {
                    // Try to temporarily switch to overview tab if it's not active just for the screenshot
                    // Assuming the visualizer might be hidden
                    const originalDisplay = container.style.display;
                    container.style.display = 'block';

                    // Capture the element
                    const dataUrl = await toPng(container, {
                        quality: 0.95,
                        backgroundColor: '#020617', // dark slate background
                        filter: (node) => {
                            // Can exclude UI controls by class name if needed
                            return !node.classList?.contains('react-flow__controls') && !node.classList?.contains('react-flow__minimap');
                        }
                    });
                    diagramImage = dataUrl;

                    container.style.display = originalDisplay;
                } catch (e) {
                    console.error("Failed to capture workflow visualizer", e);
                }
            }

            generateSecurityReport({
                id: workflow.id,
                name: workflow.name,
                active: workflow.active,
                riskScore: workflow.riskScore,
                nodes,
                securityIssues: issues
            }, n8nBaseUrl, diagramImage);

            toast.success('PDF report generated and downloaded');
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF report');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            const issues = JSON.parse(workflow.securityIssues || '[]');
            if (issues.length === 0) {
                toast.error('No security issues to export');
                return;
            }

            const headers = ['Severity', 'Issue Type', 'Node Name', 'Description'];
            const csvRows = [headers.join(',')];

            issues.forEach((issue: any) => {
                const row = [
                    issue.severity?.toUpperCase() || 'UNKNOWN',
                    `"${(issue.type || '').replace(/_/g, ' ')}"`,
                    `"${issue.nodeName || ''}"`,
                    `"${(issue.message || '').replace(/"/g, '""')}"`
                ];
                csvRows.push(row.join(','));
            });

            const csvContent = csvRows.join('\\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_security_report.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('CSV report generated and downloaded');
        } catch (error) {
            console.error('CSV generation error:', error);
            toast.error('Failed to generate CSV report');
        }
    };

    return (
        <div className="flex gap-2">
            <Button
                variant="outline"
                className="gap-2"
                onClick={handleExport}
                disabled={isGenerating}
            >
                {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <FileDown className="h-4 w-4" />
                )}
                Export PDF
            </Button>
            <Button
                variant="outline"
                className="gap-2"
                onClick={handleExportCSV}
            >
                <FileDown className="h-4 w-4" />
                Export CSV
            </Button>
        </div>
    );
}
