import { apiFetch } from "@/lib/config";
import { openPdfPage } from "@/features/common/pdf-viewer";
import type { CaseRecordSummary } from "@/features/mca/medical-analysis/types";

async function errorMessage(response: Response): Promise<string> {
  if (response.status === 413) {
    return "The file is too large to upload.";
  }
  const payload: unknown = await response.json().catch(() => null);
  const message =
    typeof payload === "object" && payload !== null && "message" in payload
      ? (payload as { message: unknown }).message
      : null;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string") return message;
  return `Upload failed (${response.status}).`;
}

/** Uploads one PDF; the server reads its pages before answering. */
export async function uploadCaseRecord(file: File): Promise<CaseRecordSummary> {
  const body = new FormData();
  body.append("file", file);
  const response = await apiFetch("/medical-analysis/records", {
    method: "POST",
    body,
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as CaseRecordSummary;
}

/** Removes an upload that is not yet part of an analysis. */
export async function deleteCaseRecord(id: string): Promise<void> {
  const response = await apiFetch(`/medical-analysis/records/${id}`, {
    method: "DELETE",
  });
  // Already gone (for example, expired) counts as removed.
  if (!response.ok && response.status !== 404) {
    throw new Error(await errorMessage(response));
  }
}

/** Opens a record at a page in a new tab (call it from a click handler). */
export function openRecordPage(
  recordId: string,
  pageNumber: number,
): Promise<void> {
  return openPdfPage(
    `/medical-analysis/records/${recordId}/file`,
    pageNumber,
    "record",
  );
}
