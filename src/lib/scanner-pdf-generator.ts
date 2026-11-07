'use client';

import autoTable from 'jspdf-autotable';
import { createStyledPDF, drawCoverHeader, drawPageDecoration, drawFooters } from './pdf-assets';

/* ─── Shared severity helpers ─── */

const SEVERITY_ORDER: Record<string, number> = {
    CRITICAL: 0, critical: 0,
    HIGH: 1, high: 1, warning: 1,
    MEDIUM: 2, medium: 2,
    LOW: 3, low: 3, info: 3,
};

const SEVERITY_COLORS: Record<string, [number, number, number]> = {
    CRITICAL: [220, 38, 38], critical: [220, 38, 38],
    HIGH: [234, 88, 12], high: [234, 88, 12], warning: [234, 88, 12],
    MEDIUM: [202, 138, 4], medium: [202, 138, 4],
    LOW: [59, 130, 246], low: [59, 130, 246], info: [59, 130, 246],
};

const SEVERITY_BG: Record<string, [number, number, number]> = {
    CRITICAL: [254, 242, 242], critical: [254, 242, 242],
    HIGH: [255, 247, 237], high: [255, 247, 237], warning: [255, 247, 237],
    MEDIUM: [254, 252, 232], medium: [254, 252, 232],
    LOW: [239, 246, 255], low: [239, 246, 255], info: [239, 246, 255],
};

function sortBySeverity<T extends { severity?: string }>(items: T[]): T[] {
    return [...items].sort((a, b) =>
        (SEVERITY_ORDER[a.severity || ''] ?? 99) - (SEVERITY_ORDER[b.severity || ''] ?? 99)
    );
}

/* ─────────────────────────────────────────── */
/*  Skill Scanner Report                       */
/* ─────────────────────────────────────────── */
export function generateSkillScannerReport(scanData: {
    target: string;
    createdAt?: string;
    findings: any[];
    skillsScanned?: string[];
    rawOutput?: string;
}) {
    const doc = createStyledPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 18;
    const dateStr = new Date(scanData.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    drawCoverHeader(doc, 'Skill Scanner Report', `Target: ${scanData.target}  ·  ${dateStr}`);

    let y = 68;

    // Info card
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, y, pw - margin * 2, 30, 3, 3, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, pw - margin * 2, 30, 3, 3, 'S');

    doc.setFont('Inter', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text('SCAN DETAILS', margin + 8, y + 7);

    const info = [
        { label: 'Target', value: scanData.target },
        { label: 'Findings', value: scanData.findings.length.toString() },
        { label: 'Skills Scanned', value: (scanData.skillsScanned || []).length.toString() || 'N/A' },
        { label: 'Date', value: dateStr },
    ];
    info.forEach((item, i) => {
        const col = i < 2 ? margin + 8 : margin + (pw - margin * 2) / 2;
        const row = i % 2 === 0 ? y + 16 : y + 24;
        doc.setFont('Inter', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(6);
        doc.text(item.label.toUpperCase(), col, row);
        doc.setFont('Inter', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(8);
        doc.text(item.value, col, row + 5);
    });

    y += 40;

    // Findings table (sorted by severity)
    const sorted = sortBySeverity(scanData.findings);

    if (sorted.length > 0) {
        doc.setFont('Inter', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('Vulnerability Findings', margin, y);
        y += 6;

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['#', 'Severity', 'Rule / Category', 'File', 'Line', 'Description']],
            body: sorted.map((f: any, i: number) => [
                (i + 1).toString(),
                (f.severity || 'N/A').toUpperCase(),
                f.rule_id || f.category || 'Unknown',
                f.skill_name && f.skill_name !== 'root'
                    ? `${f.skill_name}/${f.file_path || 'SKILL.md'}`
                    : f.file_path || 'SKILL.md',
                f.line_number?.toString() || '-',
                f.description || '-',
            ]),
            styles: { font: 'Inter', fontSize: 6, cellPadding: 3 },
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6 },
            columnStyles: {
                0: { cellWidth: 8 },
                1: { cellWidth: 18 },
                2: { cellWidth: 32 },
                3: { cellWidth: 38 },
                4: { cellWidth: 12 },
            },
            didParseCell(data: any) {
                if (data.section === 'body' && data.column.index === 1) {
                    const sev = data.cell.raw?.toLowerCase() || '';
                    data.cell.styles.textColor = SEVERITY_COLORS[sev] || [0, 0, 0];
                    data.cell.styles.fillColor = SEVERITY_BG[sev] || [255, 255, 255];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            didDrawPage() { drawPageDecoration(doc); },
        });
    } else {
        doc.setFont('Inter', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(34, 197, 94);
        doc.text('✓ No vulnerabilities detected.', margin, y + 5);
    }

    drawFooters(doc, `Skill Scanner Report — ${scanData.target}`);
    doc.save(`wisely-skill-scan-${Date.now()}.pdf`);
}


/* ─────────────────────────────────────────── */
/*  AI Spotter Report                          */
/* ─────────────────────────────────────────── */
export function generateAiSpotterReport(scanData: {
    repoUrl: string;
    createdAt?: string;
    totalDetections: number;
    servicesFound: string[];
    findings: any[];
}) {
    const doc = createStyledPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 18;
    const dateStr = new Date(scanData.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    drawCoverHeader(doc, 'AI Spotter Report', `Repository: ${scanData.repoUrl}  ·  ${dateStr}`);

    let y = 68;

    // Info card
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, y, pw - margin * 2, 30, 3, 3, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, pw - margin * 2, 30, 3, 3, 'S');

    doc.setFont('Inter', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text('SCAN DETAILS', margin + 8, y + 7);

    const info = [
        { label: 'Repository', value: scanData.repoUrl },
        { label: 'Total Detections', value: scanData.totalDetections.toString() },
        { label: 'Services Found', value: scanData.servicesFound.length > 0 ? scanData.servicesFound.join(', ') : 'None' },
        { label: 'Date', value: dateStr },
    ];
    info.forEach((item, i) => {
        const col = i < 2 ? margin + 8 : margin + (pw - margin * 2) / 2;
        const row = i % 2 === 0 ? y + 16 : y + 24;
        doc.setFont('Inter', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(6);
        doc.text(item.label.toUpperCase(), col, row);
        doc.setFont('Inter', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(7);
        const val = item.value.length > 50 ? item.value.substring(0, 50) + '...' : item.value;
        doc.text(val, col, row + 5);
    });

    y += 40;

    // Extract findings with fallback logic for legacy formats
    let findingsList = Array.isArray(scanData.findings) ? [...scanData.findings] : [];

    // Fallback 1: detections_by_service (grouped format)
    if (findingsList.length === 0 && (scanData as any).detections_by_service) {
        Object.values((scanData as any).detections_by_service).forEach((val: any) => {
            if (Array.isArray(val)) findingsList.push(...val);
        });
    }

    // Grouping by service
    const grouped: Record<string, any[]> = {};
    findingsList.forEach(f => {
        const srv = f.service_name || 'Other';
        if (!grouped[srv]) grouped[srv] = [];
        grouped[srv].push(f);
    });

    const serviceNames = Object.keys(grouped).sort();

    if (serviceNames.length > 0) {
        doc.setFont('Inter', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('Detailed Findings by Service', margin, y);
        y += 8;

        serviceNames.forEach(service => {
            // Check for page break before service header
            if (y > 260) {
                doc.addPage();
                y = 25;
            }

            doc.setFont('Inter', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 58, 138); // Deep blue for service headers
            doc.text(`Service: ${service}`, margin, y);
            y += 4;

            const serviceFindings = sortBySeverity(grouped[service]);

            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['Severity', 'Type', 'File Path (Relative)', 'Line', 'Evidence']],
                body: serviceFindings.map((f: any) => [
                    (f.severity || 'info').toUpperCase(),
                    f.detection_type || '-',
                    f.relative_file_path || f.file_path?.split('/').pop() || '-',
                    f.line_number?.toString() || '-',
                    f.evidence ? (f.evidence.length > 80 ? f.evidence.substring(0, 80) + '...' : f.evidence) : '-',
                ]),
                styles: { font: 'Inter', fontSize: 6, cellPadding: 3 },
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6 },
                columnStyles: {
                    0: { cellWidth: 16 },
                    1: { cellWidth: 18 },
                    2: { cellWidth: 46 },
                    3: { cellWidth: 10 },
                    4: { cellWidth: 'auto' }
                },
                didParseCell(data: any) {
                    if (data.section === 'body' && data.column.index === 0) {
                        const sev = data.cell.raw?.toLowerCase() || '';
                        data.cell.styles.textColor = SEVERITY_COLORS[sev] || [0, 0, 0];
                        data.cell.styles.fillColor = SEVERITY_BG[sev] || [255, 255, 255];
                        data.cell.styles.fontStyle = 'bold';
                    }
                },
                didDrawPage() { drawPageDecoration(doc); },
            });
            y = (doc as any).lastAutoTable.finalY + 12;
        });
    } else {
        doc.setFont('Inter', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(34, 197, 94);
        doc.text('✓ No AI service detections found.', margin, y + 5);
    }

    drawFooters(doc, `AI Spotter Report — ${scanData.repoUrl}`);
    doc.save(`wisely-ai-spotter-${Date.now()}.pdf`);
}


/* ─────────────────────────────────────────── */
/*  MCP Scanner Report                         */
/* ─────────────────────────────────────────── */
export function generateMcpScannerReport(scanData: {
    target: string;
    createdAt?: string;
    isMcp: boolean;
    details?: any;
    error?: string;
    rawOutput?: string;
}) {
    const doc = createStyledPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 18;
    const dateStr = new Date(scanData.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    drawCoverHeader(doc, 'MCP Scanner Report', `Target: ${scanData.target}  ·  ${dateStr}`);

    let y = 68;

    // Info card
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, y, pw - margin * 2, 30, 3, 3, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, pw - margin * 2, 30, 3, 3, 'S');

    doc.setFont('Inter', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text('SCAN DETAILS', margin + 8, y + 7);

    // Extract detailed info from normalized servers
    const servers = scanData.details?.servers || {};
    const firstServer = Object.values(servers)[0] as any;
    const metadata = firstServer?.signature?.metadata;

    const info = [
        { label: 'Target', value: scanData.target },
        { label: 'MCP Detected', value: scanData.isMcp ? '● Yes' : '○ No' },
        { label: 'Server Version', value: metadata?.serverInfo?.version ? `${metadata.serverInfo.name} v${metadata.serverInfo.version}` : 'N/A' },
        { label: 'Protocol Version', value: metadata?.protocolVersion || 'N/A' },
    ];
    info.forEach((item, i) => {
        const col = i < 2 ? margin + 8 : margin + (pw - margin * 2) / 2;
        const row = i % 2 === 0 ? y + 16 : y + 24;
        doc.setFont('Inter', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(6);
        doc.text(item.label.toUpperCase(), col, row);
        doc.setFont('Inter', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(7);
        doc.text(item.value, col, row + 5);
    });

    y += 40;

    // MCP Details per server
    Object.entries(servers).forEach(([serverName, serverData]: [string, any]) => {
        const signature = serverData.signature || {};

        doc.setFont('Inter', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`Server: ${serverName}`, margin, y);
        y += 6;

        // Findings / Vulnerabilities for this server
        const vulns = serverData.vulnerabilities || [];
        if (vulns.length > 0) {
            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['#', 'Severity', 'Vulnerability', 'Description']],
                body: vulns.map((v: any, i: number) => [
                    (i + 1).toString(),
                    (v.type || 'Warning').toUpperCase(),
                    v.type || 'Potential Issue',
                    v.description || '-'
                ]),
                styles: { font: 'Inter', fontSize: 6, cellPadding: 3 },
                headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 20 }, 2: { cellWidth: 30 } },
                didDrawPage() { drawPageDecoration(doc); },
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        // Tools table
        if (signature.tools?.length > 0) {
            doc.setFont('Inter', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(107, 114, 128);
            doc.text('DISCOVERED TOOLS', margin, y);
            y += 4;

            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['#', 'Tool Name', 'Description']],
                body: signature.tools.map((t: any, i: number) => [
                    (i + 1).toString(),
                    t.name || '-',
                    t.description || '-'
                ]),
                styles: { font: 'Inter', fontSize: 6, cellPadding: 3 },
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 } },
                didDrawPage() { drawPageDecoration(doc); },
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        // Prompts table
        if (signature.prompts?.length > 0) {
            doc.setFont('Inter', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(107, 114, 128);
            doc.text('DISCOVERED PROMPTS', margin, y);
            y += 4;

            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['#', 'Prompt Name', 'Description']],
                body: signature.prompts.map((p: any, i: number) => [
                    (i + 1).toString(),
                    p.name || '-',
                    p.description || '-'
                ]),
                styles: { font: 'Inter', fontSize: 6, cellPadding: 3 },
                headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 } },
                didDrawPage() { drawPageDecoration(doc); },
            });
            y = (doc as any).lastAutoTable.finalY + 10;
        }

        // Resources table
        if (signature.resources?.length > 0) {
            doc.setFont('Inter', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(107, 114, 128);
            doc.text('DISCOVERED RESOURCES', margin, y);
            y += 4;

            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['#', 'Resource Name / URI', 'Description']],
                body: signature.resources.map((r: any, i: number) => [
                    (i + 1).toString(),
                    r.name || r.uri || '-',
                    r.description || '-'
                ]),
                styles: { font: 'Inter', fontSize: 6, cellPadding: 3 },
                headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 50 } },
                didDrawPage() { drawPageDecoration(doc); },
            });
            y = (doc as any).lastAutoTable.finalY + 15;
        }
    });

    if (!scanData.isMcp) {
        doc.setFont('Inter', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text('No MCP protocol detected at this endpoint.', margin, y + 5);
    }

    if (scanData.error) {
        doc.setFont('Inter', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(220, 38, 38);
        doc.text('Error Output:', margin, y + 10);
        doc.setFont('Inter', 'normal');
        doc.setFontSize(6);
        doc.text(scanData.error.substring(0, 500), margin, y + 16, { maxWidth: pw - margin * 2 });
    }

    drawFooters(doc, `MCP Scanner Report — ${scanData.target}`);
    doc.save(`wisely-mcp-scan-${Date.now()}.pdf`);
}


/* ─────────────────────────────────────────── */
/*  MCP Sweep Report (multiple endpoints)      */
/* ─────────────────────────────────────────── */
export function generateMcpSweepReport(subnet: string, results: any[]) {
    const doc = createStyledPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 18;
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    drawCoverHeader(doc, 'MCP Network Sweep Report', `Subnet: ${subnet}  ·  ${dateStr}`);

    let y = 68;

    // Summary card
    const mcpFound = results.filter(r => r.isMcp);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, y, pw - margin * 2, 22, 3, 3, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, pw - margin * 2, 22, 3, 3, 'S');

    doc.setFont('Inter', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text('SWEEP SUMMARY', margin + 8, y + 7);
    doc.setFont('Inter', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.text(`${results.length} endpoints scanned  ·  ${mcpFound.length} MCP servers found`, margin + 8, y + 16);

    y += 30;

    if (results.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['#', 'URL', 'MCP', 'Protocol Version', 'Capabilities']],
            body: results.map((r: any, i: number) => [
                (i + 1).toString(),
                r.url || '-',
                r.isMcp ? '● Yes' : '○ No',
                r.protocolVersion || r.details?.protocolVersion || '-',
                r.capabilities ? (Array.isArray(r.capabilities) ? r.capabilities.join(', ') : String(r.capabilities)) : '-',
            ]),
            styles: { font: 'Inter', fontSize: 6, cellPadding: 3 },
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6 },
            columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 55 }, 2: { cellWidth: 14 } },
            didParseCell(data: any) {
                if (data.section === 'body' && data.column.index === 2) {
                    if (data.cell.raw === '● Yes') {
                        data.cell.styles.textColor = [22, 163, 74];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            },
            didDrawPage() { drawPageDecoration(doc); },
        });
    }

    drawFooters(doc, `MCP Sweep — ${subnet}`);
    doc.save(`wisely-mcp-sweep-${Date.now()}.pdf`);
}

/* ─────────────────────────────────────────── */
/*  AI BOM Scanner Report                      */
/* ─────────────────────────────────────────── */
export function generateAibomReport(scanData: {
    targetUrl: string;
    totalComponents: number;
    components: Record<string, any[]>;
}) {
    const doc = createStyledPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 18;
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    drawCoverHeader(doc, 'AI Bill of Materials', `Target: ${scanData.targetUrl}  ·  ${dateStr}`);

    let y = 68;

    // Info card
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, y, pw - margin * 2, 30, 3, 3, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, pw - margin * 2, 30, 3, 3, 'S');

    doc.setFont('Inter', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text('SCAN DETAILS', margin + 8, y + 7);

    const categories = Object.keys(scanData.components || {});

    const info = [
        { label: 'Repository Target', value: scanData.targetUrl },
        { label: 'Total Components', value: scanData.totalComponents.toString() },
        { label: 'Categories Found', value: categories.length.toString() },
        { label: 'Date', value: dateStr },
    ];
    info.forEach((item, i) => {
        const col = i < 2 ? margin + 8 : margin + (pw - margin * 2) / 2;
        const row = i % 2 === 0 ? y + 16 : y + 24;
        doc.setFont('Inter', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(6);
        doc.text(item.label.toUpperCase(), col, row);
        doc.setFont('Inter', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(8);
        doc.text(item.value, col, row + 5);
    });

    y += 40;

    categories.forEach(category => {
        const comps = scanData.components[category];
        if (!comps || comps.length === 0) return;

        doc.setFont('Inter', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`${category.toUpperCase()} COMPONENTS`, margin, y);
        y += 6;

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['#', 'Name', 'Model / Type', 'Location']],
            body: comps.map((c: any, i: number) => {
                const loc = c.file_path ? `${c.file_path}:${c.line_number || '?'}` : 'Unknown';
                const type = c.model_name || c.agent_type || c.category || '-';
                return [
                    (i + 1).toString(),
                    c.name || 'Unnamed',
                    type,
                    loc
                ];
            }),
            styles: { font: 'Inter', fontSize: 7, cellPadding: 4, overflow: 'linebreak' },
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 60 }, 3: { cellWidth: 50 } },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            didDrawPage() { drawPageDecoration(doc); },
        });

        y = (doc as any).lastAutoTable.finalY + 12;

        if (y > doc.internal.pageSize.getHeight() - 40) {
            doc.addPage();
            drawPageDecoration(doc);
            y = 25;
        }
    });

    if (scanData.totalComponents === 0) {
        doc.setFont('Inter', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('No AI components were detected in this repository.', margin, y);
    }

    drawFooters(doc, `AI BOM Report — ${scanData.targetUrl}`);
    doc.save(`wisely-aibom-${Date.now()}.pdf`);
}
