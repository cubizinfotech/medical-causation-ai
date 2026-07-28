"use client";

import dynamic from "next/dynamic";
import { PageContainer } from "@/components/layout";

const ReportView = dynamic(() => import("./report-view"), {
  ssr: false,
  loading: () => (
    <PageContainer className="py-20 text-center text-muted-foreground">
      Loading report…
    </PageContainer>
  ),
});

export default function ReportPage() {
  return <ReportView />;
}
