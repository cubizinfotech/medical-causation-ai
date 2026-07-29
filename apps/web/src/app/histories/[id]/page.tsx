import HistoryDetailView from "./history-detail-view";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HistoryDetailView id={id} />;
}
