import { apiFetch } from "@/lib/config";
import { ApiError, parseApiResponse } from "@/features/common/api";
import { openPdfPage } from "@/features/common/pdf-viewer";
import { downloadFileName, saveBlob } from "@/features/common/file-download";
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

  /**
   * Saves the PDF report and returns the name it was saved under. A report
   * saved as Word before the PDF template is rebuilt as a PDF on download,
   * so the name comes from the response, not from the stored file name.
   */
  async downloadReport(id: string, fileName: string): Promise<string> {
    return this.saveReport(`/ewi/histories/${id}/report`, fileName);
  }

  /** Saves the report as a Word file (built on request from the investigation). */
  async downloadWordReport(id: string, fileName: string): Promise<string> {
    return this.saveReport(`/ewi/histories/${id}/report/word`, fileName);
  }

  /** Saves a separate PDF of unique source URLs from the investigation. */
  async downloadSourceLinksReport(
    id: string,
    fileName: string,
  ): Promise<string> {
    return this.saveReport(`/ewi/histories/${id}/report/links`, fileName);
  }

  private async saveReport(path: string, fileName: string): Promise<string> {
    const response = await apiFetch(path);
    if (!response.ok) {
      try {
        await parseApiResponse<never>(response);
      } catch (error) {
        if (error instanceof ApiError) {
          const hint =
            response.status === 404
              ? " The PDF may still be generating, or the stored file is missing — try Export Word, then Retry download."
              : "";
          throw new ApiError(`${error.message}${hint}`, error.status);
        }
        throw error;
      }
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new ApiError(
        "The report file was empty. Try Export Word, or re-run the investigation and download again.",
        502,
      );
    }
    const name = downloadFileName(
      response.headers.get("Content-Disposition"),
      fileName,
      blob.type || response.headers.get("Content-Type") || "",
    );
    saveBlob(blob, name);
    return name;
  }
}

export const ewiClient = new EwiClient();
