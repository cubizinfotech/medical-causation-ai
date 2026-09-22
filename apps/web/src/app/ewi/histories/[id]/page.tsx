"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout";
import { ewiClient } from "@/features/ewi/ewi.service";
import type { EwiHistoryDetail } from "@/features/ewi/types";
import { formatReportDate } from "@/utils/format-date";

export default function EwiHistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [detail, setDetail] = useState<EwiHistoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void ewiClient
      .getHistory(id)
      .then(setDetail)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load");
      });
  }, [id]);

  if (error) {
    return (
      <PageContainer className="py-10">
        <p className="text-destructive">{error}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/ewi/histories">Back</Link>
        </Button>
      </PageContainer>
    );
  }

  if (!detail) {
    return (
      <PageContainer className="py-10">
        <p className="text-muted-foreground">Loading…</p>
      </PageContainer>
    );
  }

  const result = detail.result;

  return (
    <PageContainer className="py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {detail.expertName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {detail.specialty} · {detail.status} · {formatReportDate(detail.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.reportFileName && (
            <Button asChild>
              <a href={ewiClient.reportDownloadUrl(detail.id)} download>
                Download Word Report
              </a>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/ewi/histories">All Histories</Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              void ewiClient.deleteHistory(detail.id).then(() => {
                router.push("/ewi/histories");
              });
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      {result && (
        <div className="space-y-8">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Summary</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.questionCount} cross-examination questions ·{" "}
              {result.evidence.length} evidence items ·{" "}
              {result.discrepancies.length} discrepancy findings
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{result.disclaimer}</p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Discrepancies</h2>
            <ul className="space-y-3">
              {result.discrepancies.map((d) => (
                <li key={d.id} className="text-sm">
                  <p className="font-medium">
                    [{d.severity}] {d.title}
                  </p>
                  <p className="text-muted-foreground">{d.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">
              Sample Questions (first 10 of {result.questionCount})
            </h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {result.questions.slice(0, 10).map((q) => (
                <li key={q.number}>
                  <span className="font-medium">{q.category}:</span> {q.question}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </PageContainer>
  );
}
