import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Assuming this exists
import { getWorkflows } from '@/lib/actions';
import { SyncButton } from '@/components/SyncButton';
import { ScannerSettingsDialog } from '@/components/ScannerSettingsDialog';
import { ImportWorkflowButton } from '@/components/ImportWorkflowButton';
import { DownloadWorkflowButton } from '@/components/DownloadWorkflowButton';
import Link from 'next/link';
import { AlertTriangle, CheckCircle, Search, Filter, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export default async function WorkflowsPage() {
    const workflows = await getWorkflows();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">Workflows</h1>
                    <p className="text-muted-foreground">Manage and audit your n8n workflow inventory.</p>
                </div>
                <div className="flex items-center gap-2">
                    <ScannerSettingsDialog />
                    <ImportWorkflowButton />
                    <SyncButton />
                </div>
            </div>

            <Card className="border-none shadow-sm bg-muted/40">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search workflows..."
                            className="pl-9 bg-background border-none shadow-sm"
                        />
                    </div>
                    <Button variant="outline" className="gap-2 bg-background border-none shadow-sm">
                        <Filter className="h-4 w-4" />
                        Status
                    </Button>
                    <Button variant="outline" className="gap-2 bg-background border-none shadow-sm">
                        <Filter className="h-4 w-4" />
                        Risk Level
                    </Button>
                </CardContent>
            </Card>

            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[300px]">Name</TableHead>
                            <TableHead>Environment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Security Risk</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {workflows.map((workflow) => (
                            <TableRow key={workflow.id} className="group hover:bg-muted/30 transition-colors">
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <Link href={`/workflows/${workflow.id}`} className="flex items-center gap-1 font-medium text-primary hover:underline transition-colors">
                                                {workflow.name}
                                                <ExternalLink className="h-3 w-3" />
                                            </Link>
                                            {workflow.hasSuspiciousInput && (
                                                <Badge variant="destructive" className="h-4 px-1.5 text-[10px] bg-red-500/10 text-red-600 border-red-200 animate-pulse flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Suspicious Input
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground font-mono">{workflow.id.substring(0, 8)}...</span>
                                        <span className="text-[10px] text-muted-foreground font-medium mt-0.5">by {workflow.owner || 'System'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-xs bg-muted/50 font-normal">
                                        {(workflow as any).environment?.name || 'Unknown'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {workflow.active ? (
                                        <Badge variant="secondary" className="bg-green-500/15 text-green-600 hover:bg-green-500/25 border-green-200">
                                            Active
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-secondary text-muted-foreground hover:bg-secondary/80">
                                            Inactive
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {workflow.riskScore >= 70 ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border bg-red-500/10 text-red-600 border-red-200">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                Critical Risk ({workflow.riskScore})
                                            </div>
                                        ) : workflow.riskScore >= 40 ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border bg-orange-500/10 text-orange-600 border-orange-200">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                High Risk ({workflow.riskScore})
                                            </div>
                                        ) : workflow.riskScore > 0 ? (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border bg-yellow-500/10 text-yellow-600 border-yellow-200">
                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                Medium Risk ({workflow.riskScore})
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 border border-green-200">
                                                <CheckCircle className="h-3.5 w-3.5" />
                                                Safe
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm" suppressHydrationWarning>
                                    {workflow.n8nCreatedAt ? new Date(workflow.n8nCreatedAt).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    }) : '-'}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm" suppressHydrationWarning>
                                    {workflow.n8nUpdatedAt ? new Date(workflow.n8nUpdatedAt).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }) : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <DownloadWorkflowButton workflow={workflow} />
                                        <Link href={`/workflows/${workflow.id}`}>
                                            <Button variant="default" size="sm" className="h-8 text-xs font-medium px-3 shadow-sm hover:translate-y-[-1px] transition-all">
                                                View Details
                                            </Button>
                                        </Link>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {workflows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                            <Search className="h-6 w-6 text-muted-foreground/50" />
                                        </div>
                                        <p>No workflows found.</p>
                                        <p className="text-xs">Click "Sync Workflows" to import your workflows.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
