import { apiFetch } from "@/lib/config";
import { ApiError, parseApiResponse } from "@/features/common/api";
import type { ExpertInvestigationFormValues } from "./schemas/expert-form.schema";
import type {
  CreateEwiJobResponse,
  EwiHistoryDetail,
  EwiHistoryListItem,
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

  async deleteHistory(id: string): Promise<void> {
    const response = await apiFetch(`/ewi/histories/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      await parseApiResponse<never>(response);
    }
  }

  async downloadReport(id: string, fileName: string): Promise<void> {
    const response = await apiFetch(`/ewi/histories/${id}/report`);
    if (!response.ok) {
      await parseApiResponse<never>(response);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

export const ewiClient = new EwiClient();
