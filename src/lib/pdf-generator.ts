'use client';

import autoTable from 'jspdf-autotable';
import { createStyledPDF, drawCoverHeader, drawPageDecoration, drawFooters, drawWiselyLogo } from './pdf-assets';

interface SecurityIssue {
    type: string;
    severity: string;
    nodeName: string;
    nodeId: string;
    index: number;
    message: string;
    solution?: string;
}

interface WorkflowData {
    id: string;
    name: string;
    active: boolean;
    riskScore: number;
    nodes: any[];
    securityIssues: SecurityIssue[];
}

const SEVERITY_COLORS: Record<string, [number, number, number]> = {
    critical: [220, 38, 38],
    high: [234, 88, 12],
    medium: [202, 138, 4],
    low: [59, 130, 246]
};

const SEVERITY_BG: Record<string, [number, number, number]> = {
    critical: [254, 242, 242],
    high: [255, 247, 237],
    medium: [254, 252, 232],
    low: [239, 246, 255]
};

function drawRiskGauge(doc: any, x: number, y: number, score: number) {
    const color: [number, number, number] = score >= 70 ? [220, 38, 38] : score >= 40 ? [234, 88, 12] : [34, 197, 94];
    // Outer ring
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(2.5);
    doc.circle(x, y, 16, 'S');
    // Colored ring
    doc.setDrawColor(...color);
    doc.setLineWidth(2.5);
    doc.circle(x, y, 16, 'S');
    // Score
    doc.setFont('Inter', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...color);
    doc.text(score.toString(), x, y + 2, { align: 'center' });
    doc.setFont('Inter', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(107, 114, 128);
    doc.text('/ 100', x, y + 7, { align: 'center' });
    doc.setFontSize(5);
    doc.text('RISK SCORE', x, y - 11, { align: 'center' });
}

export function generateSecurityReport(workflow: WorkflowData, n8nBaseUrl?: string, diagramImage?: string | null): void {
    const doc = createStyledPDF();
    const pw = doc.internal.pageSize.getWidth();
    const margin = 18;

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    drawCoverHeader(
        doc,
        'Security Assessment Report',
        `Report ID: WIS-${workflow.id.substring(0, 8).toUpperCase()}  ·  ${dateStr}`
    );

    // Sort issues by severity (Critical > High > Medium > Low) before generating report
    workflow.securityIssues.sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
    });

    let y = 68;

    // ── Workflow Info Card ──
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, y, pw - margin * 2, 40, 3, 3, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, pw - margin * 2, 40, 3, 3, 'S');

    doc.setFont('Inter', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text('WORKFLOW DETAILS', margin + 8, y + 7);

    const infoItems = [
        { label: 'Name', value: workflow.name },
        { label: 'ID', value: workflow.id },
        { label: 'Status', value: workflow.active ? '● Active' : '○ Inactive' },
        { label: 'Nodes', value: workflow.nodes.length.toString() },
    ];
    infoItems.forEach((item, i) => {
        const col = i < 2 ? margin + 8 : margin + (pw - margin * 2) / 2;
        const row = i % 2 === 0 ? y + 16 : y + 28;
        doc.setFont('Inter', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(6);
        doc.text(item.label.toUpperCase(), col, row);
        doc.setFont('Inter', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9);
        doc.text(item.value, col, row + 5);
    });

    drawRiskGauge(doc, pw - margin - 24, y + 20, workflow.riskScore);
    y += 52;

    // ── Severity Cards ──
    const criticalCount = workflow.securityIssues.filter(i => i.severity === 'critical').length;
    const highCount = workflow.securityIssues.filter(i => i.severity === 'high').length;
    const mediumCount = workflow.securityIssues.filter(i => i.severity === 'medium').length;
    const lowCount = workflow.securityIssues.filter(i => i.severity === 'low').length;

    doc.setFont('Inter', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text('EXECUTIVE SUMMARY', margin, y);
    y += 7;

    const cardWidth = (pw - margin * 2 - 12) / 4;
    const summaryData = [
        { label: 'Critical', count: criticalCount, color: SEVERITY_COLORS.critical, bg: SEVERITY_BG.critical },
        { label: 'High', count: highCount, color: SEVERITY_COLORS.high, bg: SEVERITY_BG.high },
        { label: 'Medium', count: mediumCount, color: SEVERITY_COLORS.medium, bg: SEVERITY_BG.medium },
        { label: 'Low', count: lowCount, color: SEVERITY_COLORS.low, bg: SEVERITY_BG.low }
    ];

    summaryData.forEach(({ label, count, color, bg }, i) => {
        const cx = margin + i * (cardWidth + 4);
        doc.setFillColor(...bg);
        doc.roundedRect(cx, y, cardWidth, 26, 2, 2, 'F');
        doc.setFillColor(...color);
        doc.rect(cx, y, 3, 26, 'F');
        doc.setFont('Inter', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...color);
        doc.text(count.toString(), cx + cardWidth / 2 + 2, y + 13, { align: 'center' });
        doc.setFont('Inter', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(107, 114, 128);
        doc.text(label.toUpperCase(), cx + cardWidth / 2 + 2, y + 21, { align: 'center' });
    });
    y += 36;

    // ── Summary line ──
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, y, pw - margin * 2, 10, 2, 2, 'F');
    doc.setFont('Inter', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(75, 85, 99);
    const riskLevel = workflow.riskScore >= 70 ? 'HIGH' : workflow.riskScore >= 40 ? 'MODERATE' : 'LOW';
    doc.text(`Total Findings: ${workflow.securityIssues.length}  ·  Nodes: ${workflow.nodes.length}  ·  Risk: ${riskLevel}`, margin + 6, y + 7);
    y += 18;

    // ── Visualizer Diagram ──
    if (diagramImage) {
        doc.setFont('Inter', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(107, 114, 128);
        doc.text('ARCHITECTURE OVERVIEW', margin, y);
        y += 4;

        try {
            // Render the image into an area of 170x100
            const imgWidth = pw - margin * 2;
            const imgHeight = 90;

            // Add a container box for it
            doc.setFillColor(2, 6, 23); // very dark background like the UI
            doc.roundedRect(margin, y, imgWidth, imgHeight, 2, 2, 'F');

            // Plop the image inside
            doc.addImage(diagramImage, 'PNG', margin, y, imgWidth, imgHeight);

            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.5);
            doc.roundedRect(margin, y, imgWidth, imgHeight, 2, 2, 'S');

            y += imgHeight + 10;
            if (y > 240) { doc.addPage(); drawPageDecoration(doc); y = 18; }
        } catch (e) {
            console.error("Failed to render diagram into PDF", e);
        }
    }

    // ── Findings Table ──
    doc.setFont('Inter', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(107, 114, 128);
    doc.text('FINDINGS OVERVIEW', margin, y);
    y += 4;

    if (workflow.securityIssues.length === 0) {
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(margin, y, pw - margin * 2, 16, 2, 2, 'F');
        doc.setFont('Inter', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(22, 163, 74);
        doc.text('No security issues detected', margin + 8, y + 10);
    } else {
        autoTable(doc, {
            startY: y,
            head: [['#', 'Severity', 'Vulnerability', 'Node', 'Description']],
            body: workflow.securityIssues.map((issue, i) => [
                (i + 1).toString(),
                issue.severity.toUpperCase(),
                issue.type.replace(/_/g, ' '),
                issue.nodeName,
                issue.message.length > 70 ? issue.message.substring(0, 70) + '…' : issue.message
            ]),
            theme: 'plain',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, cellPadding: 3.5 },
            bodyStyles: { fontSize: 7, cellPadding: 3, lineColor: [243, 244, 246], lineWidth: 0.4, textColor: [55, 65, 81] },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 18, fontStyle: 'bold' }, 2: { cellWidth: 30 }, 3: { cellWidth: 28 }, 4: { cellWidth: 'auto' } },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.column.index === 1) {
                    const sev = data.cell.raw?.toString().toLowerCase();
                    const color = SEVERITY_COLORS[sev];
                    if (color) data.cell.styles.textColor = color;
                }
            },
            didDrawPage: () => drawPageDecoration(doc),
            margin: { left: margin, right: margin }
        });
    }

    // ── Detailed Findings ──
    if (workflow.securityIssues.length > 0) {
        doc.addPage();
        drawPageDecoration(doc);
        y = 18;

        doc.setFont('Inter', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(107, 114, 128);
        doc.text('DETAILED FINDINGS', margin, y);
        y += 8;

        workflow.securityIssues.forEach((issue, index) => {
            if (y > 230) { doc.addPage(); drawPageDecoration(doc); y = 18; }

            const [cr, cg, cb] = SEVERITY_COLORS[issue.severity] || [100, 100, 100];
            const [br, bg2, bb] = SEVERITY_BG[issue.severity] || [249, 250, 251];

            // Card header
            doc.setFillColor(br, bg2, bb);
            doc.roundedRect(margin, y, pw - margin * 2, 8, 2, 2, 'F');
            doc.setFillColor(cr, cg, cb);
            doc.rect(margin, y, 3, 8, 'F');

            doc.setFont('Inter', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(cr, cg, cb);
            doc.text(issue.severity.toUpperCase(), margin + 7, y + 6);
            doc.setTextColor(15, 23, 42);
            doc.text(`#${index + 1}  ${issue.type.replace(/_/g, ' ').toUpperCase()}`, margin + 28, y + 6);
            y += 13;

            // Message
            doc.setFont('Inter', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(55, 65, 81);
            const msgLines = doc.splitTextToSize(issue.message, pw - margin * 2 - 16);
            doc.text(msgLines, margin + 7, y);
            y += msgLines.length * 4 + 3;

            // Node info bar
            doc.setFillColor(243, 244, 246);
            doc.roundedRect(margin + 7, y, pw - margin * 2 - 14, 9, 1, 1, 'F');
            doc.setFont('Inter', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(107, 114, 128);
            doc.text(`Node: ${issue.nodeName}  ·  ID: ${issue.nodeId || 'N/A'}  ·  Index: ${issue.index ?? 'N/A'}`, margin + 11, y + 6);
            y += 13;

            // Code snippet
            const node = workflow.nodes.find(n => n.id === issue.nodeId || n.name === issue.nodeName);
            if (node?.parameters) {
                if (y > 205) { doc.addPage(); drawPageDecoration(doc); y = 18; }

                doc.setFont('Inter', 'bold');
                doc.setFontSize(5);
                doc.setTextColor(107, 114, 128);
                doc.text('VULNERABLE CONFIGURATION', margin + 7, y);
                y += 4;

                const codeStr = JSON.stringify(node.parameters, null, 2).substring(0, 600);
                const codeLines = codeStr.split('\n').slice(0, 12);
                const codeHeight = codeLines.length * 3.5 + 6;

                doc.setFillColor(30, 41, 59);
                doc.roundedRect(margin + 7, y, pw - margin * 2 - 14, codeHeight, 2, 2, 'F');

                codeLines.forEach((line, i) => {
                    doc.setFont('Inter', 'normal');
                    doc.setFontSize(5.5);
                    doc.setTextColor(100, 116, 139);
                    doc.text((i + 1).toString().padStart(2, ' '), margin + 9, y + 4 + i * 3.5);
                    doc.setTextColor(226, 232, 240);
                    doc.text(line.substring(0, 90), margin + 17, y + 4 + i * 3.5);
                });
                y += codeHeight + 4;
            }

            // Remediation
            if (issue.solution) {
                if (y > 240) { doc.addPage(); drawPageDecoration(doc); y = 18; }
                const solLines = doc.splitTextToSize(issue.solution, pw - margin * 2 - 28);
                const solH = solLines.length * 3.5 + 8;

                doc.setFillColor(240, 253, 244);
                doc.roundedRect(margin + 7, y, pw - margin * 2 - 14, solH, 2, 2, 'F');
                doc.setFillColor(34, 197, 94);
                doc.rect(margin + 7, y, 3, solH, 'F');

                doc.setFont('Inter', 'bold');
                doc.setFontSize(5);
                doc.setTextColor(22, 101, 52);
                doc.text('REMEDIATION', margin + 15, y + 5);
                doc.setFont('Inter', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(55, 65, 81);
                doc.text(solLines, margin + 15, y + 10);
                y += solH + 4;
            }

            // n8n link
            if (n8nBaseUrl && issue.nodeName) {
                const cleanBase = n8nBaseUrl.replace(/\/$/, '');
                const link = `${cleanBase}/workflow/${workflow.id}?node=${encodeURIComponent(issue.nodeName)}`;
                doc.setFont('Inter', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(124, 58, 237);
                doc.textWithLink('Open in n8n Editor', margin + 7, y, { url: link });
                y += 5;
            }

            // Separator
            y += 3;
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.line(margin + 7, y, pw - margin - 7, y);
            y += 6;
        });
    }

    drawFooters(doc, workflow.name);
    doc.save(`wisely-report-${workflow.id.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.pdf`);
}
