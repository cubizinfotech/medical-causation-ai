import { apiUrl } from "@/lib/config";
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
    const response = await fetch(apiUrl("/medical-analysis/jobs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    return parseApiResponse<CreateMedicalAnalysisJobResponse>(response);
  }

  async getJob(jobId: string): Promise<MedicalAnalysisJobRecord> {
    const response = await fetch(apiUrl(`/medical-analysis/jobs/${jobId}`));
    return parseApiResponse<MedicalAnalysisJobRecord>(response);
  }

  async listHistories(): Promise<AnalysisHistoryListItem[]> {
    const response = await fetch(apiUrl("/medical-analysis/histories"));
    return parseApiResponse<AnalysisHistoryListItem[]>(response);
  }

  async getHistory(id: string): Promise<AnalysisHistoryDetail> {
    const response = await fetch(apiUrl(`/medical-analysis/histories/${id}`));
    return parseApiResponse<AnalysisHistoryDetail>(response);
  }

  async deleteHistory(id: string): Promise<void> {
    const response = await fetch(apiUrl(`/medical-analysis/histories/${id}`), {
      method: "DELETE",
    });

    if (!response.ok) {
      await parseApiResponse<never>(response);
    }
  }
}

export const medicalAnalysisClient = new MedicalAnalysisClient();
