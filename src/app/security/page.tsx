import { getWorkflows, getN8nAdvisories } from '@/lib/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SecurityTable } from '@/components/SecurityTable';

export default async function SecurityPage() {
    const workflows = await getWorkflows();

    // Aggregate issues
    let allIssues: any[] = [];
    workflows.forEach(wf => {
        if (wf.securityIssues) {
            const issues = JSON.parse(wf.securityIssues);
            issues.forEach((issue: any) => {
                allIssues.push({
                    ...issue,
                    workflowId: wf.id,
                    workflowName: wf.name,
                    environmentName: (wf as any).environment?.name || 'Unknown'
                });
            });
        }
    });

    const { environments } = await getN8nAdvisories();
    environments.forEach((env: any) => {
        if (env.affectedVulnerabilities && env.affectedVulnerabilities.length > 0) {
            env.affectedVulnerabilities.forEach((adv: any) => {
                allIssues.push({
                    severity: adv.severity.toLowerCase(),
                    type: 'n8n_vulnerability',
                    message: adv.summary,
                    nodeName: 'Instance Level',
                    workflowId: `/n8n-security`, // Redirects to the n8n-security page instead of a workflow
                    workflowName: 'N/A',
                    environmentName: env.name,
                    solution: adv.affectedVersions
                });
            });
        }
    });

    // Sort by severity (Critical > High > Medium > Low)
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Security Report</h1>
                <p className="text-muted-foreground">Global view of security vulnerabilities across your n8n instance.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400">Critical Issues</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                            {allIssues.filter(i => i.severity === 'critical').length}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400">High Severity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                            {allIssues.filter(i => i.severity === 'high').length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Vulnerabilities</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{allIssues.length}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Findings</CardTitle>
                    <CardDescription>Detailed list of detected security issues.</CardDescription>
                </CardHeader>
                <CardContent>
                    <SecurityTable issues={allIssues} />
                </CardContent>
            </Card>
        </div>
    );
}
