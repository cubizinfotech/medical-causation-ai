import { apiUrl } from "@/lib/config";
import type { AnalyzeCaseRequest, MedicalAnalysisResult } from "./types";

const ANALYSIS_TIMEOUT_MS = 180_000;

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

export class MedicalAnalysisClient {
  private readonly basePath = "/medical-analysis/analyze";

  async analyze(request: AnalyzeCaseRequest): Promise<MedicalAnalysisResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl(this.basePath), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload
            ? Array.isArray((payload as { message: unknown }).message)
              ? ((payload as { message: string[] }).message).join(", ")
              : String((payload as { message: unknown }).message)
            : `Analysis request failed (${response.status})`;
        throw new ApiError(message, response.status, payload);
      }

      return payload as MedicalAnalysisResult;
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
