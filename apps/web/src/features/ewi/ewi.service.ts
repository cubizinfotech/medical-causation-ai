import { apiUrl } from "@/lib/config";
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
    const response = await fetch(apiUrl("/ewi/jobs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return parseApiResponse<CreateEwiJobResponse>(response);
  }

  async getJob(jobId: string): Promise<EwiInvestigationJobRecord> {
    const response = await fetch(apiUrl(`/ewi/jobs/${jobId}`));
    return parseApiResponse<EwiInvestigationJobRecord>(response);
  }

  async listHistories(): Promise<EwiHistoryListItem[]> {
    const response = await fetch(apiUrl("/ewi/histories"));
    return parseApiResponse<EwiHistoryListItem[]>(response);
  }

  async getHistory(id: string): Promise<EwiHistoryDetail> {
    const response = await fetch(apiUrl(`/ewi/histories/${id}`));
    return parseApiResponse<EwiHistoryDetail>(response);
  }

  async deleteHistory(id: string): Promise<void> {
    const response = await fetch(apiUrl(`/ewi/histories/${id}`), {
      method: "DELETE",
    });
    if (!response.ok) {
      await parseApiResponse<never>(response);
    }
  }

  reportDownloadUrl(id: string): string {
    return apiUrl(`/ewi/histories/${id}/report`);
  }
}

export const ewiClient = new EwiClient();
