"use client";

import dynamic from "next/dynamic";
import { PageContainer } from "@/components/layout";

const HistoryDetailView = dynamic(() => import("./history-detail-view"), {
  ssr: false,
  loading: () => (
    <PageContainer className="py-20 text-center text-muted-foreground">
      Loading case history…
    </PageContainer>
  ),
});

export default function HistoryDetailPageClient({ id }: { id: string }) {
  return <HistoryDetailView id={id} />;
}
