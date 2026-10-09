import DemandLetterPageClient from "./demand-letter-page-client";

export default async function DemandLetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DemandLetterPageClient id={id} />;
}
