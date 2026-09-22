"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { MedicalReport } from "@/components/mca/report/medical-report";
import { Badge } from "@/components/ui/badge";
import { loadAnalysisResult } from "@/features/mca/demo/storage/case-storage";
import type { MedicalAnalysisResult } from "@/features/mca/medical-analysis/types";

export default function ReportView() {
  const router = useRouter();
  const [result] = useState<MedicalAnalysisResult | null>(() =>
    loadAnalysisResult(),
  );

  if (!result) {
    router.replace("/mca/case");
    return null;
  }

  return (
    <div className="border-b border-border bg-gradient-to-b from-accent/20 to-background">
      <PageContainer className="pb-16 pt-10">
        <div className="mb-8 max-w-3xl">
          <Badge variant="secondary" className="mb-3">
            MCA Report
          </Badge>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Causation Report
              </h1>
              <p className="mt-1 text-muted-foreground">
                Evidence-based medical causation analysis for attorney review.
              </p>
            </div>
          </div>
        </div>
        <MedicalReport result={result} />
      </PageContainer>
    </div>
  );
}
