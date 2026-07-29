import HistoryDetailPageClient from "./history-detail-page-client";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HistoryDetailPageClient id={id} />;
}
