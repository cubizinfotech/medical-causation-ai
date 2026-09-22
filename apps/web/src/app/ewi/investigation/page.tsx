"use client";

import dynamic from "next/dynamic";

const EwiInvestigationView = dynamic(
  () => import("./investigation-view"),
  { ssr: false },
);

export default function EwiInvestigationPage() {
  return <EwiInvestigationView />;
}
