import type { MedicalAnalysisResult } from "@/features/medical-analysis/types";

export function buildReportMarkdown(result: MedicalAnalysisResult): string {
  const lines: string[] = [
    "# Medical Causation Analysis Report",
    "",
    `Generated: ${new Date(result.metadata.generatedAt).toLocaleString()}`,
    "",
    "## Executive Summary",
    result.executiveSummary,
    "",
    `**Confidence Score:** ${result.confidenceScore.score}/100`,
    result.confidenceScore.explanation,
    "",
    "## Medical Causation Opinion",
    result.causationOpinion || result.conclusion,
    "",
    "## Supporting Evidence",
    ...result.supportingEvidence.map(
      (e, i) =>
        `${i + 1}. ${e.excerpt}\n   — ${e.citation.documentName}, p. ${e.citation.pageNumber ?? "n/a"}\n   Reasoning: ${e.reasoning}`,
    ),
    "",
    "## Opposing Evidence",
    ...(result.opposingEvidence.length
      ? result.opposingEvidence.map(
          (e, i) =>
            `${i + 1}. ${e.excerpt}\n   — ${e.citation.documentName}\n   Reasoning: ${e.reasoning}`,
        )
      : ["None identified."]),
    "",
    "## Medical Reasoning",
    result.aiReasoning,
    "",
    "## Timeline of Events",
    ...result.timelineEvents.map((e) => `- **${e.date}:** ${e.event} — ${e.significance}`),
    "",
    "## Risk Factors",
    ...result.riskFactors.map((r) => `- **${r.factor}** (${r.category}): ${r.impact}`),
    "",
    "## Public Research Sources",
    ...result.publicReferences.map(
      (r) => `- [${r.title}](${r.url}) — ${r.source} (${r.year ?? "n.d."})`,
    ),
    "",
    "## Private Knowledge Base Sources",
    ...result.privateReferences.map(
      (r) => `- ${r.citationText} — ${r.documentName}`,
    ),
    "",
    "## Cross-Examination Questions",
  ];

  for (const category of result.crossExamination) {
    lines.push("", `### ${category.name}`);
    category.questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.question}`);
    });
  }

  lines.push("", "## Legal Disclaimer", result.legalDisclaimer);
  return lines.join("\n");
}

export function downloadReport(result: MedicalAnalysisResult): void {
  const markdown = buildReportMarkdown(result);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `medical-causation-report-${Date.now()}.md`;
  link.click();
  URL.revokeObjectURL(url);
}
