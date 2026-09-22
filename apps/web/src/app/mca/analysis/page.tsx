"use client";

import dynamic from "next/dynamic";
import { PageContainer } from "@/components/layout";

const AnalysisView = dynamic(() => import("./analysis-view"), {
  ssr: false,
  loading: () => (
    <PageContainer className="py-20 text-center text-muted-foreground">
      Loading case…
    </PageContainer>
  ),
});

export default function AnalysisPage() {
  return <AnalysisView />;
}
