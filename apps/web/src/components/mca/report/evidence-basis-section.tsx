import { ExternalLink, Info, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  AlternativeExplanation,
  AnalysisCitation,
  EvidenceBasis,
  EvidenceBasisMode,
} from "@/features/mca/medical-analysis/types";
import { RecordPageLink } from "@/components/mca/report/record-page-link";

const MODE_LABELS: Record<EvidenceBasisMode, string> = {
  knowledge_base: "Firm medical library",
  knowledge_base_and_literature: "Firm library and published studies",
  literature: "Published studies (PubMed)",
  general_knowledge: "AI reasoning only — no cited source",
};

const SOURCE_LABELS: Record<NonNullable<AnalysisCitation["sourceKind"]>, string> = {
  knowledge_base: "Firm library",
  public_literature: "PubMed",
  medical_record: "Client record",
};

/** What the analysis rests on, shown before the findings. */
export function EvidenceBasisSection({ basis }: { basis: EvidenceBasis }) {
  const uncited = basis.mode === "general_knowledge";
  return (
    <div
      className={
        uncited
          ? "rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          : "rounded-lg border border-border bg-muted/30 p-4 text-sm"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={uncited ? "destructive" : "secondary"}>
          {MODE_LABELS[basis.mode]}
        </Badge>
        <Badge variant="outline">
          {basis.knowledgeBasePassages} library{" "}
          {basis.knowledgeBasePassages === 1 ? "passage" : "passages"}
        </Badge>
        <Badge variant="outline">
          {basis.literatureArticles} PubMed{" "}
          {basis.literatureArticles === 1 ? "abstract" : "abstracts"}
        </Badge>
        {basis.recordEntries > 0 ? (
          <Badge variant="outline">
            {basis.recordEntries} client record{" "}
            {basis.recordEntries === 1 ? "entry" : "entries"}
          </Badge>
        ) : null}
        {basis.usesGeneralKnowledge ? (
          <Badge variant="outline">Includes AI general-knowledge reasoning</Badge>
        ) : null}
      </div>
      <p className="mt-3 leading-relaxed">{basis.note}</p>
      <p className="mt-2 flex gap-1.5 text-xs opacity-80">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          This report supports a medical-causation review. It is not a medical
          diagnosis, and a sequence of events alone does not establish
          causation.
        </span>
      </p>
    </div>
  );
}

/** Where a cited item comes from, with a link to open it. */
export function CitationSource({ citation }: { citation: AnalysisCitation }) {
  const kind = citation.sourceKind ?? "knowledge_base";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
        {SOURCE_LABELS[kind]}
      </Badge>
      {kind === "medical_record" && citation.recordId && citation.pageNumber ? (
        <RecordPageLink recordId={citation.recordId} pageNumber={citation.pageNumber}>
          {citation.documentName} · Page {citation.pageNumber}
        </RecordPageLink>
      ) : kind === "public_literature" && citation.url ? (
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          {citation.documentName}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : (
        <span>
          {citation.documentName}
          {citation.pageNumber ? ` · Page ${citation.pageNumber}` : ""}
        </span>
      )}
    </span>
  );
}

export function AlternativeExplanationsList({
  items,
}: {
  items: AlternativeExplanation[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No alternative explanations were identified.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.explanation}
          className="rounded-lg border border-border p-4 text-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{item.explanation}</p>
            <Badge
              variant={item.basis === "cited_evidence" ? "secondary" : "outline"}
            >
              {item.basis === "cited_evidence"
                ? "Cited evidence"
                : "AI reasoning (general medical knowledge)"}
            </Badge>
          </div>
          {item.assessment ? (
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {item.assessment}
            </p>
          ) : null}
          {item.citations.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {item.citations.map((citation) => (
                <li key={citation.chunkId}>
                  <CitationSource citation={citation} />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Statements the AI drew from general medical knowledge, not a source. */
export function GeneralKnowledgeList({ statements }: { statements: string[] }) {
  return (
    <div className="space-y-3">
      <p className="flex gap-1.5 text-sm text-muted-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          These points come from the AI model&apos;s general medical knowledge.
          No source in the firm library or PubMed was cited for them; have a
          qualified medical expert verify them before relying on them.
        </span>
      </p>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
        {statements.map((statement) => (
          <li key={statement}>{statement}</li>
        ))}
      </ul>
    </div>
  );
}
