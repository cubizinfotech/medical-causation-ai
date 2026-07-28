"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { PageContainer } from "@/components/layout";
import { MedicalReport } from "@/components/report/medical-report";
import { Badge } from "@/components/ui/badge";
import { loadAnalysisResult } from "@/features/demo/storage/case-storage";
import type { MedicalAnalysisResult } from "@/features/medical-analysis/types";

export default function ReportView() {
  const router = useRouter();
  const [result] = useState<MedicalAnalysisResult | null>(() =>
    loadAnalysisResult(),
  );

  useEffect(() => {
    if (!result) {
      router.replace("/case");
    }
  }, [result, router]);

  if (!result) {
    return (
      <PageContainer className="py-20 text-center text-muted-foreground">
        Loading report…
      </PageContainer>
    );
  }

  return (
    <div className="border-b border-border bg-gradient-to-b from-accent/20 to-background">
      <PageContainer className="py-10">
        <div className="mb-8 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <Badge variant="secondary" className="mb-2">
              Final Report
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight">
              Medical Causation Report
            </h1>
            <p className="mt-1 max-w-3xl text-muted-foreground">
              {result.medicalQuestion}
            </p>
          </div>
        </div>
        <MedicalReport result={result} />
      </PageContainer>
    </div>
  );
}
