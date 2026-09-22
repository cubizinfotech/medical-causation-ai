import { redirect } from "next/navigation";

export default async function HistoryDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/mca/histories/${id}`);
}
