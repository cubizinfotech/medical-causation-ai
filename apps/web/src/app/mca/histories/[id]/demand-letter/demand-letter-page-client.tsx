"use client";

import dynamic from "next/dynamic";
import { PageContainer } from "@/components/layout";

const DemandLetterView = dynamic(() => import("./demand-letter-view"), {
  ssr: false,
  loading: () => (
    <PageContainer className="py-20 text-center text-muted-foreground">
      Loading the case…
    </PageContainer>
  ),
});

export default function DemandLetterPageClient({ id }: { id: string }) {
  return <DemandLetterView id={id} />;
}
