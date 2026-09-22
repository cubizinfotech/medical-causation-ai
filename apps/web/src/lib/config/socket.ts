import { apiConfig } from "@/lib/config";

export function medicalAnalysisSocketUrl(): string {
  const base = apiConfig.baseUrl.replace(/\/$/, "");
  return `${base}/medical-analysis`;
}

export function ewiSocketUrl(): string {
  const base = apiConfig.baseUrl.replace(/\/$/, "");
  return `${base}/ewi`;
}
