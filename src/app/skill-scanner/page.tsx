'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCode2, Search, Loader2, PlayCircle, ShieldAlert, AlertTriangle, ShieldCheck, UploadCloud, Github, Clock } from 'lucide-react';
import { uploadAndScanSkill, scanSkillGitRepo, SkillScanResult, getSkillHistory } from '@/lib/skill-actions';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScheduleSection } from '@/components/ScheduleSection';
import { generateSkillScannerReport } from '@/lib/scanner-pdf-generator';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export default function SkillScannerPage() {
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [scanning, setScanning] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const [useBehavioral, setUseBehavioral] = useState(true);
    const [useLlm, setUseLlm] = useState(false);
    const [useTrigger, setUseTrigger] = useState(false);

    const [results, setResults] = useState<SkillScanResult[]>([]);
    const [repoUrl, setRepoUrl] = useState('');
    const [token, setToken] = useState('');
    const [activeTab, setActiveTab] = useState('upload');
    const [history, setHistory] = useState<any[]>([]);
    const [historyPage, setHistoryPage] = useState(0);
    const HISTORY_PER_PAGE = 10;

    const fetchHistory = async () => {
        try {
            const h = await getSkillHistory();
            setHistory(h);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleUploadScan = async () => {
        if (!file) return;

        setScanning(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const scanResult = await uploadAndScanSkill(formData, {
                behavioral: useBehavioral,
                llm: useLlm,
                trigger: useTrigger
            });
            setResults(prev => [scanResult, ...prev]);
            await fetchHistory();
        } catch (error) {
            console.error(error);
        }
        setScanning(false);
    };

    const handleGitScan = async () => {
        if (!repoUrl) return;

        setScanning(true);
        try {
            const scanResult = await scanSkillGitRepo(repoUrl, {
                behavioral: useBehavioral,
                llm: useLlm,
                trigger: useTrigger,
                token
            });
            setResults(prev => [scanResult, ...prev]);
            await fetchHistory();
        } catch (error) {
            console.error(error);
        }
        setScanning(false);
    };

    const handleExportCSV = (target: string, findings: any[]) => {
        if (!findings || findings.length === 0) {
            toast.info('No vulnerabilities detected to export');
            return;
        }

        const headers = ['Target', 'Skill Name', 'Severity', 'Rule ID', 'Description', 'File', 'Line'];
        const csvRows = [headers.join(',')];

        findings.forEach((f: any) => {
            csvRows.push([
                `"${target}"`,
                `"${f.skill_name || ''}"`,
                `"${f.severity || ''}"`,
                `"${f.rule_id || f.category || ''}"`,
                `"${(f.description || '').replace(/"/g, '""')}"`,
                `"${f.file_path || ''}"`,
                `"${f.line_number || ''}"`
            ].join(','));
        });

        const csvContent = csvRows.join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `skill_scan_${target.replace(/[^a-z0-9]/gi, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Generated CSV report');
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <FileCode2 className="h-8 w-8 text-primary" />
                        AI Skill Scanner
                    </h1>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                    Identify prompt injections, data exfiltration, and malicious code patterns inside AI Agent Skill descriptions and functions.
                    Powered by Cisco's <code>cisco-ai-skill-scanner</code>.
                </p>
            </div>

            <div className="grid min-w-0 gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-8">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="upload">File / Archive Upload</TabsTrigger>
                            <TabsTrigger value="git">Git Repository</TabsTrigger>
                        </TabsList>

                        <TabsContent value="upload">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Skill Scan Configuration</CardTitle>
                                    <CardDescription>Upload a SKILL.md file or a .zip archive containing agent skills to scan.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex flex-col md:flex-row items-end gap-4">
                                        <div className="flex-1 space-y-2 w-full">
                                            <Label>Upload Skill Archive or Markdown</Label>
                                            <div
                                                className={`border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center transition-colors cursor-pointer ${isDragging ? 'border-primary bg-primary/10' : 'bg-muted/20 hover:bg-muted/30'
                                                    }`}
                                                onClick={() => fileInputRef.current?.click()}
                                                onDragOver={handleDragOver}
                                                onDragLeave={handleDragLeave}
                                                onDrop={handleDrop}
                                            >
                                                <UploadCloud className={`h-8 w-8 mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                                                <span className={`text-sm ${isDragging ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                                                    {file ? file.name : (isDragging ? "Drop file here to upload" : "Drag & drop or click to select a .zip or .md file")}
                                                </span>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    className="hidden"
                                                    accept=".zip,.md"
                                                    onChange={handleFileChange}
                                                />
                                            </div>
                                        </div>
                                        <Button onClick={handleUploadScan} disabled={scanning || !file} className="gap-2 w-full md:w-auto mt-4 md:mt-0">
                                            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                                            Run Skill Scan
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                                        <div className="flex items-center justify-between space-x-2">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">Behavioral Engine</Label>
                                                <p className="text-xs text-muted-foreground">AST dataflow & taint analysis</p>
                                            </div>
                                            <Switch checked={useBehavioral} onCheckedChange={setUseBehavioral} />
                                        </div>
                                        <div className="flex items-center justify-between space-x-2">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">Trigger Specificity</Label>
                                                <p className="text-xs text-muted-foreground">Detect overly broad triggers</p>
                                            </div>
                                            <Switch checked={useTrigger} onCheckedChange={setUseTrigger} />
                                        </div>
                                        <div className="flex items-center justify-between space-x-2">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">LLM Semantic Analysis</Label>
                                                <p className="text-xs text-muted-foreground">Requires API credentials in Env</p>
                                            </div>
                                            <Switch checked={useLlm} onCheckedChange={setUseLlm} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="git">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Git Repository Scanning</CardTitle>
                                    <CardDescription>Enter a public Git repository URL containing agent skills or workflows to analyze.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex flex-col md:flex-row items-end gap-4">
                                        <div className="flex-1 space-y-2 w-full">
                                            <Label>Git Repository URL</Label>
                                            <Input
                                                placeholder="e.g., https://github.com/organization/agent-project"
                                                value={repoUrl}
                                                onChange={e => setRepoUrl(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleGitScan()}
                                            />
                                        </div>
                                        <div className="flex-1 space-y-2 w-full">
                                            <Label className="flex justify-between items-center text-muted-foreground">Git Token <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Optional</span></Label>
                                            <Input
                                                type="password"
                                                placeholder="For private repos (e.g. glpat-...)"
                                                value={token}
                                                onChange={e => setToken(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleGitScan()}
                                            />
                                        </div>
                                        <Button onClick={handleGitScan} disabled={scanning || !repoUrl} className="w-full md:w-auto gap-2">
                                            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                                            Scan Repository
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                                        <div className="flex items-center justify-between space-x-2">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">Behavioral Engine</Label>
                                                <p className="text-xs text-muted-foreground">AST dataflow & taint analysis</p>
                                            </div>
                                            <Switch checked={useBehavioral} onCheckedChange={setUseBehavioral} />
                                        </div>
                                        <div className="flex items-center justify-between space-x-2">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">Trigger Specificity</Label>
                                                <p className="text-xs text-muted-foreground">Detect overly broad triggers</p>
                                            </div>
                                            <Switch checked={useTrigger} onCheckedChange={setUseTrigger} />
                                        </div>
                                        <div className="flex items-center justify-between space-x-2">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">LLM Semantic Analysis</Label>
                                                <p className="text-xs text-muted-foreground">Requires API credentials in Env</p>
                                            </div>
                                            <Switch checked={useLlm} onCheckedChange={setUseLlm} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>

                    <div className="space-y-6">
                        {results.length > 0 && (
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => {
                                        const allFindings = results.flatMap(r => {
                                            const findings = r.details?.findings || [];
                                            return findings.map((f: any) => ({ ...f, skill_name: f.skill_name }));
                                        });
                                        generateSkillScannerReport({
                                            target: repoUrl || results[0]?.path || 'Upload Scan',
                                            findings: allFindings,
                                            skillsScanned: results.map(r => r.path).filter(Boolean) as string[],
                                        });
                                    }}
                                >
                                    <Download className="h-4 w-4" />
                                    PDF
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 ml-2"
                                    onClick={() => {
                                        const allFindings = results.flatMap(r => {
                                            const findings = r.details?.findings || [];
                                            return findings.map((f: any) => ({ ...f, skill_name: f.skill_name }));
                                        });
                                        handleExportCSV(repoUrl || results[0]?.path || 'Upload Scan', allFindings);
                                    }}
                                >
                                    <Download className="h-4 w-4" />
                                    CSV
                                </Button>
                            </div>
                        )}
                        {results.map((res, idx) => {
                            const isError = !res.success || res.error;
                            const parsed = res.details || {};
                            const findings = parsed.findings || [];
                            const hasFindings = findings.length > 0;

                            return (
                                <Card key={idx} className={hasFindings ? "border-red-200" : (isError ? "border-orange-200" : "border-green-200")}>
                                    <CardHeader className={`pb-3 border-b ${hasFindings ? 'bg-red-50/30' : (isError ? 'bg-orange-50/30' : 'bg-green-50/30')}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Search className="h-5 w-5 text-muted-foreground" />
                                                <CardTitle className="text-lg font-mono text-sm max-w-[400px] truncate" title={res.path}>
                                                    {res.path}
                                                </CardTitle>
                                            </div>
                                            {isError ? (
                                                <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">Execution Error</Badge>
                                            ) : hasFindings ? (
                                                <Badge variant="destructive" className="flex items-center gap-1">
                                                    <ShieldAlert className="h-3 w-3" />
                                                    {findings.length} Vulnerabilities Found
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 flex items-center gap-1">
                                                    <ShieldCheck className="h-3 w-3" />
                                                    No Threats Detected
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4 space-y-4">

                                        {isError && (
                                            <div className="text-orange-800 font-mono text-xs bg-orange-50/80 p-4 rounded border border-orange-100">
                                                {res.error || "The scanner exited with an unknown error."}
                                            </div>
                                        )}

                                        {hasFindings && (
                                            <div className="space-y-4">
                                                {findings.map((finding: any, findIdx: number) => {
                                                    const severityColor =
                                                        finding.severity === 'CRITICAL' ? 'bg-red-600' :
                                                            finding.severity === 'HIGH' ? 'bg-orange-500' :
                                                                finding.severity === 'MEDIUM' ? 'bg-yellow-500' : 'bg-blue-500';

                                                    return (
                                                        <div key={findIdx} className="border rounded-md overflow-hidden bg-card">
                                                            <div className="flex justify-between items-start p-3 bg-muted/40 border-b">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Badge className={severityColor}>{finding.severity}</Badge>
                                                                        <span className="font-semibold text-sm">{finding.rule_id || finding.category}</span>
                                                                    </div>
                                                                    <p className="text-sm text-muted-foreground">{finding.description}</p>
                                                                </div>
                                                                {finding.confidence && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        Confidence: {finding.confidence}
                                                                    </Badge>
                                                                )}
                                                            </div>

                                                            {finding.file_path && (
                                                                <div className="p-3 text-xs font-mono bg-muted/10 border-b">
                                                                    <span className="text-muted-foreground">File: </span>
                                                                    {finding.file_path}
                                                                    {finding.line_number && <span className="text-muted-foreground ml-2">Line: {finding.line_number}</span>}
                                                                </div>
                                                            )}

                                                            {finding.snippet && (
                                                                <div className="p-3">
                                                                    <pre className="text-xs bg-red-50 text-red-900 border border-red-100 p-2 rounded overflow-x-auto">
                                                                        {finding.snippet}
                                                                    </pre>
                                                                </div>
                                                            )}

                                                            {finding.analyzer && (
                                                                <div className="px-3 pb-3 text-[10px] text-muted-foreground flex justify-end">
                                                                    Detected by: {finding.analyzer} filter
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {res.rawOutput && (
                                            <details className="mt-4">
                                                <summary className="text-xs text-muted-foreground cursor-pointer hover:underline">View Raw JSON / CLI Output</summary>
                                                <pre className="mt-2 text-[10px] bg-muted p-4 rounded overflow-auto max-h-64 border">
                                                    {res.rawOutput}
                                                </pre>
                                            </details>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}

                        {results.length === 0 && !scanning && (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                <FileCode2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                <p>No agent skills have been scanned yet.</p>
                                <p className="text-sm mt-2 opacity-80">Upload a resource or provide a Git Repo above to inspect skills for vulnerabilities.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="min-w-0 space-y-6">
                    <Card className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden md:max-h-[850px]">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="h-5 w-5" /> Scan History
                            </CardTitle>
                            <CardDescription>Recent skill vulnerability checks</CardDescription>
                        </CardHeader>
                        <CardContent className="min-w-0 flex-1 p-0">
                            <div className="h-full max-h-[700px] w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto border-t">
                                <div className="min-w-0 space-y-4 p-4">
                                    {history.slice(historyPage * HISTORY_PER_PAGE, (historyPage + 1) * HISTORY_PER_PAGE).map((item) => {
                                        let parsed: any = null;
                                        try { parsed = item.results ? JSON.parse(item.results) : null; } catch (e) { }
                                        const findings = parsed?.findings || [];

                                        return (
                                            <details key={item.id} className="group min-w-0 max-w-full overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50">
                                                <summary className="min-w-0 cursor-pointer list-none p-3">
                                                    <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                                                        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={item.target}>
                                                            {item.target.split('/').pop()}
                                                        </span>
                                                        <Badge className="shrink-0" variant={item.status === 'success' && item.hasFindings ? 'destructive' : 'secondary'}>
                                                            {item.status === 'success' ? (item.hasFindings ? `${item.findingsCount} Vulns` : 'Clean') : 'Error'}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {new Date(item.createdAt).toLocaleString()}
                                                    </div>
                                                    {item.status === 'success' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full text-xs h-8 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                if (item.target.startsWith('http')) {
                                                                    setRepoUrl(item.target);
                                                                    setActiveTab('git');
                                                                } else {
                                                                    setFile(null);
                                                                    setActiveTab('upload');
                                                                }
                                                                setResults([{
                                                                    success: true,
                                                                    path: item.target,
                                                                    rawOutput: JSON.stringify(parsed, null, 2),
                                                                    details: parsed
                                                                }]);
                                                            }}
                                                        >
                                                            View Full Report &rarr;
                                                        </Button>
                                                    )}
                                                </summary>
                                                <div className="min-w-0 max-w-full space-y-2 overflow-hidden border-t px-3 pb-3 pt-1">
                                                    {item.error && (
                                                        <p className="whitespace-pre-wrap break-words font-mono text-xs text-red-500 [overflow-wrap:anywhere]">{item.error}</p>
                                                    )}
                                                    {findings.length > 0 ? findings.map((f: any, i: number) => (
                                                        <div key={i} className="min-w-0 max-w-full space-y-0.5 overflow-hidden border-l-2 border-red-400 pl-2 text-xs">
                                                            <p className="max-w-full break-all font-semibold">{f.rule_id || f.category || 'Finding'}</p>
                                                            {(f.file_path || f.skill_name) && (
                                                                <p className="max-w-full break-all font-mono text-muted-foreground">
                                                                    📄 {f.skill_name && f.skill_name !== 'root' ? `${f.skill_name}/` : ''}{f.file_path || 'SKILL.md'}
                                                                    {f.line_number && <span className="text-orange-600 ml-1">:L{f.line_number}</span>}
                                                                </p>
                                                            )}
                                                            {f.description && (
                                                                <p className="max-h-28 max-w-full overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-all rounded bg-muted/30 p-1 text-muted-foreground">
                                                                    {f.description}
                                                                </p>
                                                            )}
                                                            {f.severity && <Badge variant="outline" className="text-[10px] mt-0.5">{f.severity}</Badge>}
                                                        </div>
                                                    )) : (
                                                        <p className="text-xs text-muted-foreground">{item.status === 'success' ? 'No vulnerabilities detected.' : 'Scan did not complete successfully.'}</p>
                                                    )}
                                                </div>
                                            </details>
                                        );
                                    })}
                                    {history.length === 0 && (
                                        <div className="text-center text-sm text-muted-foreground py-8">
                                            No scans recorded yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                            {history.length > HISTORY_PER_PAGE && (
                                <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
                                    <button onClick={() => setHistoryPage(p => Math.max(0, p - 1))} disabled={historyPage === 0} className="text-primary disabled:text-muted-foreground disabled:cursor-not-allowed">← Prev</button>
                                    <span className="text-muted-foreground">{historyPage + 1} / {Math.ceil(history.length / HISTORY_PER_PAGE)}</span>
                                    <button onClick={() => setHistoryPage(p => Math.min(Math.ceil(history.length / HISTORY_PER_PAGE) - 1, p + 1))} disabled={historyPage >= Math.ceil(history.length / HISTORY_PER_PAGE) - 1} className="text-primary disabled:text-muted-foreground disabled:cursor-not-allowed">Next →</button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="pt-4 border-t">
                <ScheduleSection scanType="skill_scanner" targetPlaceholder="https://github.com/user/skills-repo" />
            </div>
        </div>
    );
}
