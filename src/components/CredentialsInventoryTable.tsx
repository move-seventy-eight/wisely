'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    CircleAlert,
    ExternalLink,
    Info,
    Key,
    Lock,
    Search,
    Shield,
    ShieldCheck,
    Workflow,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    assessCredentialSecurity,
    CredentialSecurityRating,
} from '@/lib/credential-security';

interface Credential {
    id: string;
    name: string;
    type: string;
    environment: {
        name: string;
        baseUrl: string;
    };
    workflows: string;
}

interface WorkflowSummary {
    id: string;
    name: string;
    active: boolean;
    riskScore: number;
}

interface CredentialsInventoryTableProps {
    initialCredentials: Credential[];
    workflowMap?: Map<string, WorkflowSummary> | Record<string, WorkflowSummary>;
    workflowsList?: WorkflowSummary[];
}

const ratingConfig: Record<CredentialSecurityRating, {
    label: string;
    badgeClass: string;
    barClass: string;
    icon: typeof ShieldCheck;
}> = {
    strong: {
        label: 'Strong',
        badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        barClass: 'bg-emerald-500',
        icon: ShieldCheck,
    },
    moderate: {
        label: 'Moderate',
        badgeClass: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
        barClass: 'bg-blue-500',
        icon: Shield,
    },
    weak: {
        label: 'Weak',
        badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        barClass: 'bg-amber-500',
        icon: AlertTriangle,
    },
    critical: {
        label: 'Critical',
        badgeClass: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
        barClass: 'bg-red-500',
        icon: CircleAlert,
    },
};

function formatCredentialType(type: string) {
    return type.replace('Api', ' API').replace('OAuth2', ' OAuth2');
}

function parseWorkflowIds(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed
                .map((item) => {
                    if (typeof item === 'string') return item.trim();
                    if (typeof item === 'number') return String(item);
                    if (item && typeof item === 'object') {
                        return String(item.id || item.name || '');
                    }
                    return '';
                })
                .filter(Boolean);
        }
        if (typeof parsed === 'string') return [parsed.trim()];
        if (typeof parsed === 'number') return [String(parsed)];
    } catch {
        // Fallback for plain comma-separated strings
        return value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [];
}

export function CredentialsInventoryTable({
    initialCredentials,
    workflowMap,
    workflowsList,
}: CredentialsInventoryTableProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedRating, setSelectedRating] = useState<CredentialSecurityRating | null>(null);
    const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);

    // Normalize workflows collection safely across Client-Server boundary
    const allWorkflows: WorkflowSummary[] = useMemo(() => {
        if (workflowsList && workflowsList.length > 0) return workflowsList;
        if (workflowMap) {
            if (workflowMap instanceof Map) {
                return Array.from(workflowMap.values());
            }
            if (typeof workflowMap === 'object') {
                return Object.values(workflowMap);
            }
        }
        return [];
    }, [workflowsList, workflowMap]);

    // Map by both ID and Name to ensure any identifier reliably resolves
    const resolvedWorkflowMap = useMemo(() => {
        const map = new Map<string, WorkflowSummary>();
        allWorkflows.forEach((w) => {
            map.set(w.id, w);
            if (w.name) {
                map.set(w.name, w);
            }
        });
        return map;
    }, [allWorkflows]);

    const resolveWorkflow = (workflowId: string): WorkflowSummary | undefined => {
        let match = resolvedWorkflowMap.get(workflowId);
        if (match) return match;

        match = allWorkflows.find(
            (w) => w.id === workflowId || w.name.toLowerCase() === workflowId.toLowerCase()
        );
        return match;
    };

    const analyzedCredentials = useMemo(() => initialCredentials.map((credential) => {
        const workflowIds = parseWorkflowIds(credential.workflows);
        const workflows = workflowIds
            .map((workflowId) => resolveWorkflow(workflowId))
            .filter((workflow): workflow is WorkflowSummary => Boolean(workflow));
        const assessment = assessCredentialSecurity({
            type: credential.type,
            environmentBaseUrl: credential.environment.baseUrl,
            workflows: workflows.map((workflow) => ({
                active: workflow.active,
                riskScore: workflow.riskScore,
            })),
        });

        return { credential, workflowIds, workflows, assessment };
    }), [initialCredentials, resolvedWorkflowMap, allWorkflows]);

    const authTypes = useMemo(() => Array.from(
        new Set(initialCredentials.map((credential) => credential.type)),
    ).sort(), [initialCredentials]);

    const filteredCredentials = useMemo(() => {
        const normalizedSearch = searchQuery.trim().toLowerCase();

        return analyzedCredentials.filter(({ credential, assessment }) => {
            const matchesSearch = normalizedSearch === ''
                || credential.name.toLowerCase().includes(normalizedSearch)
                || credential.type.toLowerCase().includes(normalizedSearch)
                || credential.id.toLowerCase().includes(normalizedSearch);
            const matchesType = !selectedType || credential.type === selectedType;
            const matchesRating = !selectedRating || assessment.rating === selectedRating;

            return matchesSearch && matchesType && matchesRating;
        });
    }, [analyzedCredentials, searchQuery, selectedRating, selectedType]);

    const ratingCounts = useMemo(() => analyzedCredentials.reduce<Record<CredentialSecurityRating, number>>(
        (counts, item) => {
            counts[item.assessment.rating] += 1;
            return counts;
        },
        { strong: 0, moderate: 0, weak: 0, critical: 0 },
    ), [analyzedCredentials]);

    const selectedItem = analyzedCredentials.find(
        ({ credential }) => credential.id === selectedCredentialId,
    ) ?? null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Credentials Inventory</h1>
                    <p className="text-muted-foreground">
                        Audit credential posture without exposing or storing secret values.
                    </p>
                </div>
                <Badge variant="outline" className="w-fit border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                    <Shield className="mr-1.5 h-3.5 w-3.5" />
                    {filteredCredentials.length} {selectedType || selectedRating || searchQuery ? 'Matching' : 'Total'} Credentials
                </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(ratingConfig) as CredentialSecurityRating[]).map((rating) => {
                    const config = ratingConfig[rating];
                    const Icon = config.icon;

                    return (
                        <button
                            type="button"
                            key={rating}
                            onClick={() => setSelectedRating((current) => current === rating ? null : rating)}
                            className={`rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/30 ${selectedRating === rating ? 'ring-2 ring-primary/30' : ''}`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{config.label}</span>
                                <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="mt-2 text-2xl font-bold">{ratingCounts[rating]}</p>
                        </button>
                    );
                })}
            </div>

            <Card className="border-none bg-muted/20 shadow-sm">
                <CardContent className="flex flex-col gap-4 p-4 lg:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search credentials by name, ID, or type..."
                            className="border-none bg-background pl-9 shadow-sm"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className={`gap-2 border-none bg-background shadow-sm ${selectedType ? 'text-primary ring-1 ring-primary/20' : ''}`}>
                                <Lock className="h-4 w-4" />
                                {selectedType ? formatCredentialType(selectedType) : 'Auth Type'}
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[220px]">
                            <DropdownMenuItem onClick={() => setSelectedType(null)} className="font-medium">
                                All Auth Types
                            </DropdownMenuItem>
                            {authTypes.map((type) => (
                                <DropdownMenuItem key={type} onClick={() => setSelectedType(type)}>
                                    {formatCredentialType(type)}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className={`gap-2 border-none bg-background shadow-sm ${selectedRating ? 'text-primary ring-1 ring-primary/20' : ''}`}>
                                <Shield className="h-4 w-4" />
                                {selectedRating ? ratingConfig[selectedRating].label : 'Security Posture'}
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                            <DropdownMenuItem onClick={() => setSelectedRating(null)} className="font-medium">
                                All Postures
                            </DropdownMenuItem>
                            {(Object.keys(ratingConfig) as CredentialSecurityRating[]).map((rating) => (
                                <DropdownMenuItem key={rating} onClick={() => setSelectedRating(rating)}>
                                    {ratingConfig[rating].label} ({ratingCounts[rating]})
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardContent>
            </Card>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[280px]">Credential Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Environment</TableHead>
                            <TableHead>Security Posture</TableHead>
                            <TableHead>Usage Count</TableHead>
                            <TableHead>Workflows</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCredentials.map(({ credential, workflowIds, assessment }) => {
                            const config = ratingConfig[assessment.rating];

                            return (
                                <TableRow key={credential.id} className="group transition-colors hover:bg-muted/30">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                                <Key className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex min-w-0 flex-col">
                                                <span className="truncate font-semibold">{credential.name}</span>
                                                <span className="max-w-[210px] truncate font-mono text-[10px] text-muted-foreground">{credential.id}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="bg-muted/50 font-mono text-[10px] uppercase text-muted-foreground">
                                            {formatCredentialType(credential.type)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-muted/20 text-xs font-normal">
                                            {credential.environment.name}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            className="h-auto min-w-[150px] justify-start p-0 hover:bg-transparent"
                                            onClick={() => setSelectedCredentialId(credential.id)}
                                        >
                                            <div className="w-full space-y-1.5 text-left">
                                                <div className="flex items-center justify-between gap-3">
                                                    <Badge variant="outline" className={config.badgeClass}>
                                                        {config.label}
                                                    </Badge>
                                                    <span className="text-xs font-semibold tabular-nums">{assessment.score}/100</span>
                                                </div>
                                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className={`h-full rounded-full ${config.barClass}`}
                                                        style={{ width: `${assessment.score}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{workflowIds.length}</span>
                                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full bg-primary"
                                                    style={{ width: `${Math.min(100, (workflowIds.length / 5) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex max-w-[300px] flex-wrap items-center gap-1.5">
                                            {workflowIds.slice(0, 3).map((workflowId) => {
                                                const workflow = resolveWorkflow(workflowId);
                                                const targetId = workflow?.id || workflowId;
                                                const targetName = workflow?.name || workflowId;

                                                return (
                                                    <Link
                                                        key={workflowId}
                                                        href={`/workflows/${encodeURIComponent(targetId)}`}
                                                        className="inline-flex"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Badge
                                                            variant="outline"
                                                            className="max-w-[140px] cursor-pointer truncate text-[10px] transition-all hover:bg-primary/10 hover:border-primary/40 hover:text-primary flex items-center gap-1 py-0.5"
                                                            title={`Open workflow: ${targetName}`}
                                                        >
                                                            <span className="truncate">{targetName}</span>
                                                            <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                                                        </Badge>
                                                    </Link>
                                                );
                                            })}
                                            {workflowIds.length > 3 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedCredentialId(credential.id);
                                                    }}
                                                >
                                                    +{workflowIds.length - 3} more
                                                </Button>
                                            )}
                                            {workflowIds.length === 0 && (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {filteredCredentials.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                            <Search className="h-6 w-6 text-muted-foreground/50" />
                                        </div>
                                        <p>No credentials match your filters.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog
                open={Boolean(selectedItem)}
                onOpenChange={(open) => {
                    if (!open) setSelectedCredentialId(null);
                }}
            >
                {selectedItem && (() => {
                    const { credential, assessment, workflowIds } = selectedItem;
                    const config = ratingConfig[assessment.rating];

                    return (
                        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 pr-8">
                                    <ShieldCheck className="h-5 w-5 text-primary" />
                                    Credential Security Assessment
                                </DialogTitle>
                                <DialogDescription>
                                    Metadata-based analysis for {credential.name}. Secret material is never fetched or inspected.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="rounded-xl border bg-muted/20 p-5">
                                <div className="flex items-end justify-between gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Security posture</p>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="text-3xl font-bold tabular-nums">{assessment.score}</span>
                                            <span className="text-sm text-muted-foreground">/ 100</span>
                                            <Badge variant="outline" className={config.badgeClass}>{config.label}</Badge>
                                        </div>
                                    </div>
                                    <div className="text-right text-xs text-muted-foreground">
                                        <p>{formatCredentialType(credential.type)}</p>
                                        <p>{workflowIds.length} known consumer{workflowIds.length === 1 ? '' : 's'}</p>
                                    </div>
                                </div>
                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                                    <div className={`h-full rounded-full ${config.barClass}`} style={{ width: `${assessment.score}%` }} />
                                </div>
                            </div>

                            {/* Connected Workflows with Direct Clickable Navigation */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold flex items-center justify-between">
                                    <span>Connected Workflows ({workflowIds.length})</span>
                                </h3>
                                {workflowIds.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {workflowIds.map((workflowId) => {
                                            const workflow = resolveWorkflow(workflowId);
                                            const targetId = workflow?.id || workflowId;
                                            const targetName = workflow?.name || workflowId;

                                            return (
                                                <Link
                                                    key={workflowId}
                                                    href={`/workflows/${encodeURIComponent(targetId)}`}
                                                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all group"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Workflow className="h-4 w-4 text-primary shrink-0" />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
                                                                {targetName}
                                                            </span>
                                                            <span className="font-mono text-[9px] text-muted-foreground truncate">
                                                                ID: {targetId}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                        {workflow && (
                                                            <Badge
                                                                variant={workflow.active ? 'default' : 'secondary'}
                                                                className="text-[9px] h-4 px-1"
                                                            >
                                                                {workflow.active ? 'Active' : 'Inactive'}
                                                            </Badge>
                                                        )}
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">No workflows currently reference this credential.</p>
                                )}
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold">Assessment factors</h3>
                                {assessment.findings.map((finding) => {
                                    const FindingIcon = finding.kind === 'strength'
                                        ? CheckCircle2
                                        : finding.kind === 'risk'
                                            ? AlertTriangle
                                            : Info;
                                    const iconClass = finding.kind === 'strength'
                                        ? 'text-emerald-500'
                                        : finding.kind === 'risk'
                                            ? 'text-amber-500'
                                            : 'text-blue-500';

                                    return (
                                        <div key={`${finding.kind}-${finding.title}`} className="flex gap-3 rounded-lg border p-3">
                                            <FindingIcon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
                                            <div>
                                                <p className="text-sm font-medium">{finding.title}</p>
                                                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{finding.description}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold">Recommended actions</h3>
                                {assessment.recommendations.length > 0 ? (
                                    <ol className="space-y-2">
                                        {assessment.recommendations.map((recommendation, index) => (
                                            <li key={recommendation} className="flex gap-3 text-sm text-muted-foreground">
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                                    {index + 1}
                                                </span>
                                                <span>{recommendation}</span>
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No immediate corrective action was identified from the available metadata.</p>
                                )}
                            </div>

                            <div className="flex gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
                                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                                This score measures observable security posture, not the entropy of the hidden password, token, or private key. Validate secret strength and rotation at the source system.
                            </div>
                        </DialogContent>
                    );
                })()}
            </Dialog>
        </div>
    );
}
