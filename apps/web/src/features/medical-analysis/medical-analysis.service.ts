import { apiUrl } from "@/lib/config";
import type { AnalyzeCaseRequest, MedicalAnalysisResult } from "./types";
import type {
  CreateMedicalAnalysisJobResponse,
  MedicalAnalysisJobRecord,
} from "./job.types";
import type {
  AnalysisHistoryDetail,
  AnalysisHistoryListItem,
} from "./history.types";

const ANALYSIS_TIMEOUT_MS = 300_000;

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

  /** @deprecated Use submitJob + WebSocket/polling for long-running analysis */
  async analyze(request: AnalyzeCaseRequest): Promise<MedicalAnalysisResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl("/medical-analysis/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      return parseApiResponse<MedicalAnalysisResult>(response);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError(
          "Analysis timed out. The knowledge base search may still be running — please try again.",
          408,
        );
      }
      throw new ApiError(
        "Unable to reach the analysis API. Ensure the backend is running.",
        0,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const medicalAnalysisClient = new MedicalAnalysisClient();
