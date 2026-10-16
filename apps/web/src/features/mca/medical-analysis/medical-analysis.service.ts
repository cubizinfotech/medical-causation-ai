import { apiFetch } from "@/lib/config";
import { downloadFileName, saveBlob } from "@/features/common/file-download";
import type { AnalyzeCaseRequest } from "./types";
import type {
  CreateMedicalAnalysisJobResponse,
  MedicalAnalysisJobRecord,
} from "./job.types";
import type {
  AnalysisHistoryDetail,
  AnalysisHistoryListItem,
} from "./history.types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? Array.isArray((payload as { message: unknown }).message)
          ? ((payload as { message: string[] }).message).join(", ")
          : String((payload as { message: unknown }).message)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export class MedicalAnalysisClient {
  async submitJob(
    request: AnalyzeCaseRequest,
  ): Promise<CreateMedicalAnalysisJobResponse> {
    const response = await apiFetch("/medical-analysis/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    return parseApiResponse<CreateMedicalAnalysisJobResponse>(response);
  }

  async getJob(jobId: string): Promise<MedicalAnalysisJobRecord> {
    const response = await apiFetch(`/medical-analysis/jobs/${jobId}`);
    return parseApiResponse<MedicalAnalysisJobRecord>(response);
  }

  async listHistories(): Promise<AnalysisHistoryListItem[]> {
    const response = await apiFetch("/medical-analysis/histories");
    return parseApiResponse<AnalysisHistoryListItem[]>(response);
  }

  async getHistory(id: string): Promise<AnalysisHistoryDetail> {
    const response = await apiFetch(`/medical-analysis/histories/${id}`);
    return parseApiResponse<AnalysisHistoryDetail>(response);
  }

  /** Saves a finished analysis as a Word report; returns the file name. */
  async downloadWordReport(caseId: string): Promise<string> {
    const response = await apiFetch(
      `/medical-analysis/histories/${caseId}/report/word`,
    );
    if (!response.ok) {
      await parseApiResponse<never>(response);
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new ApiError("The report file was empty or could not be read.", 502);
    }
    const name = downloadFileName(
      response.headers.get("Content-Disposition"),
      "medical-causation-report.docx",
      blob.type || response.headers.get("Content-Type") || "",
    );
    saveBlob(blob, name);
    return name;
  }

  async deleteHistory(id: string): Promise<void> {
    const response = await apiFetch(`/medical-analysis/histories/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      await parseApiResponse<never>(response);
    }
  }
}

export const medicalAnalysisClient = new MedicalAnalysisClient();
