import { apiFetch } from "@/lib/config";
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

const blobUrls = new Map<string, Promise<string>>();

/**
 * The file endpoint needs the bearer token, so a plain link cannot open it.
 * Fetch it once per page load and reuse the object URL.
 */
function recordBlobUrl(recordId: string): Promise<string> {
  let url = blobUrls.get(recordId);
  if (!url) {
    url = apiFetch(`/medical-analysis/records/${recordId}/file`).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "This record is no longer available."
              : `Could not open the record (${response.status}).`,
          );
        }
        return URL.createObjectURL(await response.blob());
      },
    );
    url.catch(() => blobUrls.delete(recordId));
    blobUrls.set(recordId, url);
  }
  return url;
}

/**
 * Opens a record at a page in a new tab. Call it from a click handler:
 * the tab is opened right away so the browser does not block it.
 */
export async function openRecordPage(
  recordId: string,
  pageNumber: number,
): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const url = `${await recordBlobUrl(recordId)}#page=${pageNumber}`;
    if (tab) tab.location.href = url;
    else window.open(url, "_blank");
  } catch (error) {
    tab?.close();
    throw error;
  }
}
