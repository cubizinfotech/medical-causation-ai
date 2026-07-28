"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  Calendar,
  Download,
  ExternalLink,
  FileText,
  Gavel,
  Globe,
  Printer,
  Scale,
  Shield,
} from "lucide-react";
import type { MedicalAnalysisResult } from "@/features/medical-analysis/types";
import { downloadReport } from "@/features/report/report-export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

export function MedicalReport({ result }: { result: MedicalAnalysisResult }) {
  const crossExamCount =
    result.metadata.crossExamQuestionCount ??
    result.crossExamination.reduce((n, c) => n + c.questions.length, 0);

  return (
    <div className="space-y-8 print:space-y-6">
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card shadow-md">
        <CardContent className="p-8 sm:p-10">
          <Badge className="mb-4">Executive Summary</Badge>
          <p className="text-lg leading-relaxed text-foreground sm:text-xl">
            {result.executiveSummary}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Badge variant="secondary">
              Confidence: {result.confidenceScore.score}/100
            </Badge>
            <Badge variant="outline">
              {result.supportingEvidence.length} supporting sources
            </Badge>
            <Badge variant="outline">
              {result.opposingEvidence.length} opposing sources
            </Badge>
            <Badge variant="outline">{crossExamCount} cross-exam questions</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 print:hidden">
        <Button onClick={() => downloadReport(result)}>
          <Download className="h-4 w-4" />
          Export Report
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
        <Button variant="outline" asChild>
          <Link href="/case">New Case</Link>
        </Button>
      </div>

      <SectionCard icon={Scale} title="Confidence Score">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Evidence alignment score</span>
            <span className="font-semibold text-primary">
              {result.confidenceScore.score}/100
            </span>
          </div>
          <Progress value={result.confidenceScore.score} className="h-3" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            {result.confidenceScore.explanation}
          </p>
          <p className="text-xs text-muted-foreground">
            {result.confidenceScore.disclaimer}
          </p>
        </div>
      </SectionCard>

      <SectionCard icon={Gavel} title="Medical Causation Opinion">
        <p className="text-sm leading-7">{result.causationOpinion || result.conclusion}</p>
        {result.patientSummary ? (
          <p className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Patient summary: </span>
            {result.patientSummary}
          </p>
        ) : null}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard icon={Shield} title="Supporting Evidence">
          <EvidenceList items={result.supportingEvidence} empty="No supporting evidence identified." />
        </SectionCard>
        <SectionCard icon={AlertTriangle} title="Opposing Evidence">
          <EvidenceList items={result.opposingEvidence} empty="No opposing evidence identified." />
        </SectionCard>
      </div>

      <SectionCard icon={Brain} title="Medical Reasoning">
        <p className="whitespace-pre-wrap text-sm leading-7">{result.aiReasoning}</p>
        {result.limitations.length > 0 ? (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Limitations
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {result.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard icon={Calendar} title="Timeline of Events">
        <ol className="space-y-4">
          {result.timelineEvents.map((event) => (
            <li
              key={`${event.date}-${event.event}`}
              className="border-l-2 border-primary/30 pl-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {event.date}
              </p>
              <p className="mt-1 font-medium">{event.event}</p>
              <p className="mt-1 text-sm text-muted-foreground">{event.significance}</p>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard icon={AlertTriangle} title="Risk Factors">
        <div className="space-y-3">
          {result.riskFactors.map((factor) => (
            <div
              key={factor.factor}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{factor.factor}</p>
                <Badge variant="outline">{factor.category}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{factor.impact}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={Globe} title="Public Research Sources">
        <p className="mb-4 text-sm text-muted-foreground">
          Simulated public literature search across PubMed, NIH, ClinicalTrials.gov,
          and other biomedical databases for demonstration.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {result.researchSources.public.map((source) => (
            <div
              key={source.name}
              className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm"
            >
              <p className="font-medium">{source.name}</p>
              <p className="text-muted-foreground">{source.description}</p>
              <Badge variant="outline" className="mt-2">
                {source.status}
              </Badge>
            </div>
          ))}
        </div>
        <ul className="mt-6 space-y-3">
          {result.publicReferences.map((ref) => (
            <li key={ref.id} className="rounded-lg border border-border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{ref.source}</Badge>
                {ref.year ? (
                  <span className="text-xs text-muted-foreground">{ref.year}</span>
                ) : null}
              </div>
              <p className="mt-2 font-medium">{ref.title}</p>
              {ref.excerpt ? (
                <p className="mt-1 text-muted-foreground">{ref.excerpt}</p>
              ) : null}
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
              >
                View source <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard icon={BookOpen} title="Private Knowledge Base Sources">
        <p className="mb-4 text-sm text-muted-foreground">
          Retrieved from uploaded books, medical PDFs, and indexed internal knowledge base.
        </p>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {result.researchSources.private.map((source) => (
            <div
              key={source.name}
              className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm"
            >
              <p className="font-medium">{source.name}</p>
              <p className="text-muted-foreground">{source.description}</p>
              <p className="mt-1 text-xs font-medium text-primary">
                {source.count} sources used
              </p>
            </div>
          ))}
        </div>
        <ul className="space-y-2">
          {result.privateReferences.map((ref) => (
            <li
              key={ref.chunkId}
              className="rounded-lg border border-border px-4 py-3 text-sm"
            >
              <p className="font-medium">{ref.documentName}</p>
              <p className="text-muted-foreground">{ref.citationText}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard icon={Gavel} title="Cross-Examination Questions">
        <p className="mb-6 text-sm text-muted-foreground">
          {crossExamCount} leading questions organized for challenging opposing
          medical experts.
        </p>
        <div className="space-y-8">
          {result.crossExamination.map((category) => (
            <div key={category.name}>
              <h3 className="mb-3 font-semibold text-primary">{category.name}</h3>
              <ol className="space-y-3">
                {category.questions.map((q, index) => (
                  <li
                    key={`${category.name}-${index}`}
                    className="rounded-lg border border-border bg-card p-4 text-sm"
                  >
                    <p className="font-medium">{q.question}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{q.purpose}</p>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={FileText} title="Legal Disclaimer">
        <p className="text-sm leading-7 text-muted-foreground">
          {result.legalDisclaimer}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          See also our{" "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Use
          </Link>
          .
        </p>
      </SectionCard>
    </div>
  );
}

function EvidenceList({
  items,
  empty,
}: {
  items: MedicalAnalysisResult["supportingEvidence"];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.citation.chunkId} className="rounded-lg border border-border p-4 text-sm">
          <p className="leading-relaxed">{item.excerpt}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {item.citation.documentName}
            {item.citation.pageNumber ? `, p. ${item.citation.pageNumber}` : ""}
          </p>
          <p className="mt-2 text-muted-foreground">{item.reasoning}</p>
        </li>
      ))}
    </ul>
  );
}
