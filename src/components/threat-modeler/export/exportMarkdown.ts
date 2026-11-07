"use client";
import {
  type CanvasNode,
  type CanvasEdge,
  type ThreatAnalysisResult,
  MAESTRO_LAYER_LABELS,
} from "../types";
import type { ModelRiskSummary } from "../engine/riskScoring";
import type { AttackPath } from "../engine/attackPaths";
import type { AISVSCoverageResult } from "../engine/aisvsMapping";

interface ReportOptions {
  riskSummary?: ModelRiskSummary | null;
  attackPaths?: AttackPath[];
  aisvsResult?: AISVSCoverageResult | null;
}

export function generateMarkdownReport(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  result: ThreatAnalysisResult,
  options: ReportOptions = {},
): string {
  const { riskSummary, attackPaths, aisvsResult } = options;
  let md = `# Threat Model Report

`;
  md += `**Generated:** ${new Date().toISOString()}
`;
  md += `**Methodology:** MAESTRO 7-Layer Analysis

`;
  md += `---

`;

  // ─── Executive Summary ───────────────────────────────────
  md += `## Executive Summary

`;
  md += `| Metric | Value |
|---|---|
`;
  md += `| Total Components | ${nodes.filter((n) => n.type !== "trustBoundary").length} |
`;
  md += `| Data Flows | ${edges.length} |
`;
  md += `| Total Threats | ${result.summary.total} |
`;
  md += `| Critical | ${result.summary.critical} |
`;
  md += `| High | ${result.summary.high} |
`;
  md += `| Medium | ${result.summary.medium} |
`;
  md += `| Low | ${result.summary.low} |
`;
  md += `| Inherited | ${result.summary.inherited} |
`;
  if (result.summary.mitigated) md += `| Mitigated | ${result.summary.mitigated} |
`;
  md += "\\n\\n";

  // ─── Risk Assessment ─────────────────────────────────────
  if (riskSummary) {
    md += `## Risk Assessment

`;
    md += `| Metric | Value |
|---|---|
`;
    md += `| Overall Risk Score | **${riskSummary.overallScore}** |
`;
    md += `| Severity | **${riskSummary.severityLabel}** |

`;

    if (riskSummary.topRisks.length > 0) {
      md += `### Top Risk Components

`;
      md += `| Component | Risk Score |
|---|---|
`;
      for (const risk of riskSummary.topRisks) {
        md += `| ${risk.name} | ${risk.score} |
`;
      }
      md += "\\n\\n";
    }
  }

  // ─── AISVS Compliance ────────────────────────────────────
  if (aisvsResult && aisvsResult.totalRequirements > 0) {
    const pct = Math.round(
      (aisvsResult.identifiedRequirements / aisvsResult.totalRequirements) * 100,
    );
    const addressedPct = Math.round(
      (aisvsResult.addressedRequirements / aisvsResult.totalRequirements) * 100,
    );
    md += `## AISVS Compliance Coverage

`;
    md += `| Metric | Value |
|---|---|
`;
    md += `| Total Requirements | ${aisvsResult.totalRequirements} |
`;
    md += `| Identified | ${aisvsResult.identifiedRequirements} (${pct}%) |
`;
    md += `| Addressed (mitigated) | ${aisvsResult.addressedRequirements} (${addressedPct}%) |
`;
    md += `| Gaps | ${aisvsResult.gapRequirements} |

`;

    md += `### Coverage by Category

`;
    md += `| Category | Identified | Addressed | Total | Coverage |
|---|---|---|---|---|
`;
    for (const [cat, stats] of Object.entries(aisvsResult.coverageByCategory).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const catPct =
        stats.total > 0
          ? Math.round(((stats.identified + stats.addressed) / stats.total) * 100)
          : 0;
      md += `| ${cat} | ${stats.identified} | ${stats.addressed} | ${stats.total} | ${catPct}% |
`;
    }
    md += "\\n\\n";
  }

  // ─── Attack Paths ────────────────────────────────────────
  if (attackPaths && attackPaths.length > 0) {
    md += `## Attack Paths

`;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const topPaths = attackPaths.slice(0, 10);
    for (let i = 0; i < topPaths.length; i++) {
      const path = topPaths[i];
      const pathLabels = path.nodes.map((nId) => nodeMap.get(nId)?.data?.label ?? nId.slice(0, 8));
      md += `### Path ${i + 1} (${path.severity.toUpperCase()}, score: ${path.score})

`;
      md += `\`${pathLabels.join(" → ")}\`

`;
      if (path.threats.length > 0) {
        md += `Threats along path:
`;
        for (const t of path.threats.slice(0, 5)) {
          md += `- ${t}
`;
        }
        md += "\\n\\n";
      }
    }
  }

  // ─── Cisco Taxonomy Mapping ─────────────────────────────
  const ciscoThreats = result.threats.filter((t) => t.ciscoMapping && t.ciscoMapping.length > 0);
  if (ciscoThreats.length > 0) {
    md += `## Cisco AI Security Taxonomy Mapping

`;
    const ciscoMap = new Map<string, { name: string; count: number; techniques: Set<string> }>();
    for (const t of ciscoThreats) {
      for (const m of t.ciscoMapping!) {
        const existing = ciscoMap.get(m.objectiveId);
        if (existing) {
          existing.count++;
          m.techniques?.forEach((tech) => existing.techniques.add(tech));
        } else {
          ciscoMap.set(m.objectiveId, {
            name: m.objectiveName,
            count: 1,
            techniques: new Set(m.techniques ?? []),
          });
        }
      }
    }
    md += `| Objective ID | Objective Name | Threats Mapped |
|---|---|---|
`;
    for (const [id, data] of Array.from(ciscoMap.entries()).sort(
      (a, b) => b[1].count - a[1].count,
    )) {
      md += `| ${id} | ${data.name} | ${data.count} |
`;
    }
    md += "\\n\\n";
  }

  // ─── OWASP Agentic Top 10 Mapping ─────────────────────────
  const owaspThreats = result.threats.filter((t) => t.owaspMapping && t.owaspMapping.length > 0);
  if (owaspThreats.length > 0) {
    md += `## OWASP Agentic Top 10 Mapping

`;
    const owaspMap = new Map<string, { name: string; high: number; med: number; low: number }>();
    for (const t of owaspThreats) {
      for (const m of t.owaspMapping!) {
        const existing = owaspMap.get(m.asiId);
        if (existing) {
          if (m.confidence === "high") existing.high++;
          else if (m.confidence === "medium") existing.med++;
          else existing.low++;
        } else {
          owaspMap.set(m.asiId, {
            name: m.asiName,
            high: m.confidence === "high" ? 1 : 0,
            med: m.confidence === "medium" ? 1 : 0,
            low: m.confidence === "low" ? 1 : 0,
          });
        }
      }
    }
    md += `| ASI ID | Category | High Confidence | Medium | Low |
|---|---|---|---|---|
`;
    for (const [id, data] of Array.from(owaspMap.entries()).sort(
      (a, b) => b[1].high + b[1].med - (a[1].high + a[1].med),
    )) {
      md += `| ${id} | ${data.name} | ${data.high} | ${data.med} | ${data.low} |
`;
    }
    md += "\\n\\n";
  }

  // ─── Component Inventory ─────────────────────────────────
  md += `## Component Inventory

`;
  md += `| Component | Type | Trust Level | Threats |
|---|---|---|---|
`;
  for (const node of nodes) {
    if (node.type === "trustBoundary") continue;
    const threatCount = result.threats.filter((t) => t.affectedNodeIds.includes(node.id)).length;
    md += `| ${node.data?.label ?? "Unknown"} | ${node.data?.category ?? "-"} | ${node.data?.trustLevel ?? "-"} | ${threatCount} |
`;
  }
  md += "\\n\\n";

  // ─── Mitigation Status ───────────────────────────────────
  const nodesWithMitigations = nodes.filter((n) => n.data?.appliedMitigations?.length);
  if (nodesWithMitigations.length > 0) {
    md += `## Mitigation Status

`;
    md += `| Component | Applied Controls | Status |
|---|---|---|
`;
    for (const node of nodesWithMitigations) {
      const count = node.data?.appliedMitigations?.length ?? 0;
      md += `| ${node.data?.label ?? "Unknown"} | ${count} | Active |
`;
    }
    md += "\\n\\n";
  }

  // ─── Data Flow Inventory ─────────────────────────────────
  md += `## Data Flow Inventory

`;
  md += `| Flow | Protocol | Encrypted | Auth | Classification | PII |
|---|---|---|---|---|---|
`;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    const src = nodeMap.get(edge.source)?.data?.label ?? edge.source;
    const tgt = nodeMap.get(edge.target)?.data?.label ?? edge.target;
    const d = edge.data;
    md += `| ${src} -> ${tgt} | ${d?.protocol ?? "-"} | ${d?.encrypted ? "Yes" : "No"} | ${d?.authentication ?? "-"} | ${d?.dataClassification ?? "-"} | ${d?.containsPII ? "Yes" : "No"} |
`;
  }
  md += "\\n\\n";

  // ─── Threats ─────────────────────────────────────────────
  const severityOrder = ["critical", "high", "medium", "low"];
  const sorted = [...result.threats].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
  );

  md += `## Threats

`;
  for (const threat of sorted) {
    md += `### ${threat.severity.toUpperCase()}: ${threat.name}

`;
    md += `${threat.description}

`;
    md += `- **Methodology:** ${threat.methodology}
`;
    md += `- **Status:** ${(threat.status ?? "open").replace("-", " ")}
`;
    if (threat.statusJustification)
      md += `- **Status Justification:** ${threat.statusJustification}
`;
    if (threat.maestroLayer !== undefined)
      md += `- **MAESTRO Layer:** ${MAESTRO_LAYER_LABELS[threat.maestroLayer]}
`;
    if (threat.inherited) md += `- **Inherited:** Yes
`;
    if (threat.ciscoMapping && threat.ciscoMapping.length > 0) {
      md += `- **Cisco Taxonomy:** ${threat.ciscoMapping.map((m) => `${m.objectiveId} (${m.objectiveName})`).join(", ")}
`;
    }
    if (threat.owaspMapping && threat.owaspMapping.length > 0) {
      const highMed = threat.owaspMapping.filter((m) => m.confidence !== "low");
      if (highMed.length > 0) {
        md += `- **OWASP Agentic:** ${highMed.map((m) => `${m.asiId} (${m.asiName})`).join(", ")}
`;
      }
    }
    if (threat.mitigations.length > 0) {
      md += `- **Mitigations:**
`;
      threat.mitigations.forEach((m) => {
        md += `  - ${m}
`;
      });
    }
    md += "\\n\\n";
  }

  // ─── Prioritized Remediation ─────────────────────────────
  if (riskSummary && riskSummary.topRisks.length > 0) {
    md += `## Prioritized Remediation Plan

`;
    md += `The following components have the highest residual risk and should be addressed first:

`;
    for (let i = 0; i < riskSummary.topRisks.length; i++) {
      const risk = riskSummary.topRisks[i];
      const compThreats = result.threats.filter((t) =>
        t.affectedNodeIds.some((nId) => {
          const node = nodeMap.get(nId);
          return node?.data?.label === risk.name;
        }),
      );
      const unmitigated = compThreats.filter((t) => t.mitigations.length === 0);
      md += `${i + 1}. **${risk.name}** (risk score: ${risk.score})
`;
      if (unmitigated.length > 0) {
        md += `   - ${unmitigated.length} threat(s) without mitigations
`;
        for (const t of unmitigated.slice(0, 3)) {
          md += `   - Address: ${t.name} (${t.severity})
`;
        }
      } else {
        md += `   - All threats have mitigations defined; ensure implementation
`;
      }
    }
    md += "\\n\\n";
  }

  return md;
}

export function downloadMarkdownReport(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  result: ThreatAnalysisResult,
  options: ReportOptions = {},
): void {
  const md = generateMarkdownReport(nodes, edges, result, options);
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `threat-model-report-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
