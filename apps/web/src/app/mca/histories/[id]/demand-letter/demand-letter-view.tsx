"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { DemandLetterForm } from "@/components/mca/demand-letter/demand-letter-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EMPTY_DEMAND_LETTER,
  type DemandLetterFormValues,
} from "@/features/mca/demand-letter/demand-letter.schema";
import {
  loadDraft,
  loadSender,
} from "@/features/mca/demand-letter/demand-letter.storage";
import { medicalAnalysisClient } from "@/features/mca/medical-analysis/medical-analysis.service";
import type { AnalysisHistoryDetail } from "@/features/mca/medical-analysis/history.types";

function initialValues(
  id: string,
  detail: AnalysisHistoryDetail,
): DemandLetterFormValues {
  const hasChronology = Boolean(detail.result?.chronology?.events.length);
  const values: DemandLetterFormValues = {
    ...EMPTY_DEMAND_LETTER,
    dateOfLoss: /^\d{4}-\d{2}-\d{2}$/.test(detail.accidentDate)
      ? detail.accidentDate
      : "",
    incidentDescription: detail.accidentDescription ?? "",
    useAi: hasChronology,
    ...loadSender(),
    ...loadDraft(id),
  };
  return hasChronology ? values : { ...values, useAi: false };
}

export default function DemandLetterView({ id }: { id: string }) {
  const [detail, setDetail] = useState<AnalysisHistoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    medicalAnalysisClient
      .getHistory(id)
      .then((loaded) => {
        if (active) setDetail(loaded);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "The case could not be loaded.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link href={`/mca/histories/${id}`}>
        <ArrowLeft className="h-4 w-4" />
        Back to the case
      </Link>
    </Button>
  );

  if (error || (detail && (detail.status !== "completed" || !detail.result))) {
    return (
      <PageContainer className="py-20">
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {error ??
                "The analysis must finish before a demand letter can be drafted."}
            </p>
            {back}
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (!detail?.result) {
    return (
      <PageContainer className="py-20 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
        Loading the case…
      </PageContainer>
    );
  }

  const result = detail.result;
  return (
    <PageContainer className="py-10">
      <div className="mb-8">
        <div className="mb-4">{back}</div>
        <Badge variant="secondary" className="mb-3">
          Demand letter
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          Draft a demand letter
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          A settlement demand letter in Word, built from this case&apos;s cited
          chronology and the bills read from the records, with the facts and
          figures you add. What you enter here is not stored on the server;
          the letter downloads to your computer.
        </p>
      </div>
      <DemandLetterForm
        caseId={id}
        defaults={initialValues(id, detail)}
        specials={result.medicalSpecials}
        hasChronology={Boolean(result.chronology?.events.length)}
        highDefenseIssues={
          result.defenseIssues?.issues.filter((issue) => issue.severity === "high")
            .length ?? 0
        }
      />
    </PageContainer>
  );
}
