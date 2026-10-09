import { apiFetch } from "@/lib/config";
import { ApiError, parseApiResponse } from "@/features/common/api";
import { openPdfPage } from "@/features/common/pdf-viewer";
import type { ExpertInvestigationFormValues } from "./schemas/expert-form.schema";
import type {
  CreateEwiJobResponse,
  EwiHistoryDetail,
  EwiHistoryListItem,
  EwiExpertDocumentSummary,
  EwiInvestigationJobRecord,
} from "./types";

export { ApiError };

export class EwiClient {
  async submitJob(
    request: ExpertInvestigationFormValues,
  ): Promise<CreateEwiJobResponse> {
    const response = await apiFetch("/ewi/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return parseApiResponse<CreateEwiJobResponse>(response);
  }

  async getJob(jobId: string): Promise<EwiInvestigationJobRecord> {
    const response = await apiFetch(`/ewi/jobs/${jobId}`);
    return parseApiResponse<EwiInvestigationJobRecord>(response);
  }

  async listHistories(): Promise<EwiHistoryListItem[]> {
    const response = await apiFetch("/ewi/histories");
    return parseApiResponse<EwiHistoryListItem[]>(response);
  }

  async getHistory(id: string): Promise<EwiHistoryDetail> {
    const response = await apiFetch(`/ewi/histories/${id}`);
    return parseApiResponse<EwiHistoryDetail>(response);
  }

  async cancelHistory(id: string): Promise<EwiHistoryDetail> {
    const response = await apiFetch(`/ewi/histories/${id}/cancel`, {
      method: "POST",
    });
    return parseApiResponse<EwiHistoryDetail>(response);
  }

  async deleteHistory(id: string): Promise<void> {
    const response = await apiFetch(`/ewi/histories/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      await parseApiResponse<never>(response);
    }
  }

  /** Uploads the expert's CV (PDF); the server reads its pages first. */
  async uploadCv(file: File): Promise<EwiExpertDocumentSummary> {
    const body = new FormData();
    body.append("file", file);
    const response = await apiFetch("/ewi/documents/cv", {
      method: "POST",
      body,
    });
    if (response.status === 413) {
      throw new ApiError("The file is too large to upload.", 413);
    }
    return parseApiResponse<EwiExpertDocumentSummary>(response);
  }

  /** Removes an uploaded CV that no investigation uses yet. */
  async deleteDocument(id: string): Promise<void> {
    const response = await apiFetch(`/ewi/documents/${id}`, {
      method: "DELETE",
    });
    // Already gone (for example, expired) counts as removed.
    if (!response.ok && response.status !== 404) {
      await parseApiResponse<never>(response);
    }
  }

  /** Opens the uploaded CV at a page (call it from a click handler). */
  openDocumentPage(id: string, pageNumber: number): Promise<void> {
    return openPdfPage(`/ewi/documents/${id}/file`, pageNumber, "CV");
  }

  async downloadReport(id: string, fileName: string): Promise<void> {
    const response = await apiFetch(`/ewi/histories/${id}/report`);
    if (!response.ok) {
      await parseApiResponse<never>(response);
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new ApiError("The report file was empty or could not be read.", 502);
    }
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName || "ewi-report.docx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export const ewiClient = new EwiClient();
