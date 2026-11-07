import { getN8nAdvisories } from '@/lib/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ShieldAlert, CheckCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AdvisoriesList } from '@/components/AdvisoriesList';
import { AffectedVulnerabilitiesList } from '@/components/AffectedVulnerabilitiesList';

export const dynamic = 'force-dynamic';

export default async function N8nSecurityPage() {
    const data = await getN8nAdvisories();

    const affectedEnvironments = data.environments.filter(env => env.affectedVulnerabilities.length > 0);
    const safeEnvironments = data.environments.filter(env => env.affectedVulnerabilities.length === 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">n8n Security Analysis</h1>
                <p className="text-muted-foreground">
                    Continuous monitoring of your n8n instances against known vulnerabilities from OSV (Open Source Vulnerability) database.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-card to-card border-none shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium mb-1">Tracked Environments</p>
                            <p className="text-3xl font-bold">{data.environments.length}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-500/5 to-transparent border-red-500/20 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-red-600/80 font-medium mb-1 dark:text-red-400">Vulnerable Environments</p>
                            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{affectedEnvironments.length}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                            <ShieldAlert className="h-5 w-5 text-red-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-500/5 to-transparent border-orange-500/20 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-orange-600/80 font-medium mb-1 dark:text-orange-400">Total Advisories</p>
                            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{data.advisories.length}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500/5 to-transparent border-green-500/20 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-green-600/80 font-medium mb-1 dark:text-green-400">Secure Environments</p>
                            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{safeEnvironments.length}</p>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {affectedEnvironments.length > 0 && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Action Required</AlertTitle>
                    <AlertDescription>
                        {affectedEnvironments.length} of your n8n instances {affectedEnvironments.length > 1 ? 'are' : 'is'} running a version affected by known vulnerabilities. Check the details below and update your instances.
                    </AlertDescription>
                </Alert>
            )}

            <div className="space-y-6">
                <h2 className="text-xl font-semibold border-b pb-2">Environment Status</h2>
                {data.environments.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <ShieldCheck className="mx-auto h-12 w-12 opacity-20 mb-4" />
                            <p>No n8n environments found.</p>
                            <Link href="/settings" className="text-primary hover:underline mt-2 inline-block">Go to Settings to add one</Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                        {data.environments.map(env => (
                            <Card key={env.id} className={env.affectedVulnerabilities.length > 0 ? 'border-red-500/50 shadow-sm shadow-red-500/10' : 'border-green-500/20'}>
                                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            {env.name}
                                            {env.affectedVulnerabilities.length > 0 ? (
                                                <Badge variant="destructive" className="ml-2">Vulnerable</Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 ml-2">Secure</Badge>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-2">
                                            <span className="font-mono text-xs">{env.baseUrl}</span>
                                            {env.version ? (
                                                <Badge variant="secondary" className="font-mono">{env.version}</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs text-muted-foreground">Version Unknown</Badge>
                                            )}
                                        </CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {env.affectedVulnerabilities.length > 0 ? (
                                        <AffectedVulnerabilitiesList vulnerabilities={env.affectedVulnerabilities} />
                                    ) : (
                                        <p className="text-sm text-muted-foreground mt-2">
                                            {env.version ? 'No known vulnerabilities affect this version.' : 'Set the environment version in settings to check for vulnerabilities.'}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-6 pt-6 mt-6 border-t">
                <h2 className="text-xl font-semibold">All Known N8n Advisories Database</h2>
                <AdvisoriesList advisories={data.advisories} />
            </div>
        </div>
    );
}
