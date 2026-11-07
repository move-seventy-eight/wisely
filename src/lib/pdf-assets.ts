'use client';

import { jsPDF } from 'jspdf';
import { INTER_REGULAR, INTER_BOLD } from './pdf-fonts';

/**
 * Register Inter font with jsPDF and return the configured doc.
 * Call this instead of `new jsPDF()` to get Inter font + Turkish/UTF-8 support.
 */
export function createStyledPDF(): jsPDF {
    const doc = new jsPDF();

    // Register Inter font for each new doc (jsPDF has per-instance VFS)
    doc.addFileToVFS('Inter-Regular.ttf', INTER_REGULAR);
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    doc.addFileToVFS('Inter-Bold.ttf', INTER_BOLD);
    doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');

    doc.setFont('Inter', 'normal');
    return doc;
}

/**
 * Draw the Wisely clover logo at the specified position.
 * Renders a purple rounded-rect background with a white 4-leaf clover symbol.
 */
export function drawWiselyLogo(doc: jsPDF, x: number, y: number, size: number = 12) {
    // Purple rounded background
    doc.setFillColor(124, 58, 237);
    doc.roundedRect(x, y, size, size, size * 0.15, size * 0.15, 'F');

    // Gradient overlay (darker purple corner)
    doc.setFillColor(109, 40, 217);
    doc.roundedRect(x, y, size * 0.5, size, size * 0.15, size * 0.15, 'F');

    // Re-draw the full rounded rect border area to clean up
    doc.setFillColor(124, 58, 237);
    doc.roundedRect(x, y, size, size, size * 0.15, size * 0.15, 'F');

    // Draw a simple 4-leaf clover using circles
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size * 0.16;
    const offset = size * 0.14;

    doc.setFillColor(255, 255, 255);

    // Top leaf
    doc.circle(cx, cy - offset, r, 'F');
    // Bottom leaf
    doc.circle(cx, cy + offset, r, 'F');
    // Left leaf
    doc.circle(cx - offset, cy, r, 'F');
    // Right leaf
    doc.circle(cx + offset, cy, r, 'F');
    // Center dot (connects the leaves)
    doc.circle(cx, cy, r * 0.55, 'F');

    // Small stem
    doc.setLineWidth(size * 0.03);
    doc.setDrawColor(255, 255, 255);
    doc.line(cx, cy + offset + r * 0.3, cx + size * 0.06, cy + offset + r * 0.9);
}

/**
 * Draw standardized page decorations (top accent + bottom footer area).
 */
export function drawPageDecoration(doc: jsPDF) {
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, pw, 3, 'F');
    doc.setFillColor(248, 250, 252);
    doc.rect(0, ph - 18, pw, 18, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(0, ph - 18, pw, ph - 18);
}

/**
 * Draw standardized footer on all pages.
 */
export function drawFooters(doc: jsPDF, extraText?: string) {
    const pw = doc.internal.pageSize.getWidth();
    const pageCount = doc.getNumberOfPages();
    const margin = 18;

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const ph = doc.internal.pageSize.getHeight();
        doc.setFont('Inter', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(156, 163, 175);
        doc.text('WISELY SECURITY INTELLIGENCE', margin, ph - 7);
        doc.text(`Page ${i} of ${pageCount}`, pw - margin, ph - 7, { align: 'right' });
        doc.setTextColor(209, 213, 219);
        doc.text('CONFIDENTIAL', pw / 2, ph - 7, { align: 'center' });
        if (extraText) {
            doc.setTextColor(209, 213, 219);
            doc.text(extraText, pw / 2, ph - 12, { align: 'center' });
        }
    }
}

/**
 * Draw the cover header with logo and branding.
 */
export function drawCoverHeader(doc: jsPDF, title: string, subtitle: string) {
    const pw = doc.internal.pageSize.getWidth();
    const margin = 18;

    drawPageDecoration(doc);

    // Dark header block
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 3, pw, 52, 'F');

    // Purple accent bar
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 3, 5, 52, 'F');

    // Logo
    drawWiselyLogo(doc, margin + 4, 10, 14);

    // Brand text
    doc.setFont('Inter', 'bold');
    doc.setTextColor(167, 139, 250);
    doc.setFontSize(11);
    doc.text('WISELY', margin + 22, 18);
    doc.setFont('Inter', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text('Security Intelligence Platform', margin + 22, 23);

    // Title
    doc.setFont('Inter', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(title, margin + 4, 40);

    // Subtitle
    doc.setFont('Inter', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(subtitle, margin + 4, 48);
}
