import type { CaseFormValues } from "../schemas/case-form.schema";
import type { MedicalAnalysisResult } from "@/features/medical-analysis/types";

export const STORAGE_KEYS = {
  case: "mca:case-form",
  uploadedFiles: "mca:uploaded-files",
  analysisResult: "mca:analysis-result",
  activeAnalysis: "mca:active-analysis",
} as const;

export interface ActiveAnalysisSession {
  caseId: string;
  jobId: string;
}

export function saveCaseForm(values: CaseFormValues): void {
  sessionStorage.setItem(STORAGE_KEYS.case, JSON.stringify(values));
}

export function loadCaseForm(): CaseFormValues | null {
  const raw = sessionStorage.getItem(STORAGE_KEYS.case);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CaseFormValues;
  } catch {
    return null;
  }
}

export function saveUploadedFileNames(names: string[]): void {
  sessionStorage.setItem(STORAGE_KEYS.uploadedFiles, JSON.stringify(names));
}

export function loadUploadedFileNames(): string[] {
  const raw = sessionStorage.getItem(STORAGE_KEYS.uploadedFiles);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function saveAnalysisResult(result: MedicalAnalysisResult): void {
  sessionStorage.setItem(STORAGE_KEYS.analysisResult, JSON.stringify(result));
}

export function loadAnalysisResult(): MedicalAnalysisResult | null {
  const raw = sessionStorage.getItem(STORAGE_KEYS.analysisResult);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MedicalAnalysisResult;
  } catch {
    return null;
  }
}

export function clearAnalysisResult(): void {
  sessionStorage.removeItem(STORAGE_KEYS.analysisResult);
}

export function saveActiveAnalysis(session: ActiveAnalysisSession): void {
  sessionStorage.setItem(
    STORAGE_KEYS.activeAnalysis,
    JSON.stringify(session),
  );
}

export function loadActiveAnalysis(): ActiveAnalysisSession | null {
  const raw = sessionStorage.getItem(STORAGE_KEYS.activeAnalysis);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveAnalysisSession;
  } catch {
    return null;
  }
}

export function clearActiveAnalysis(): void {
  sessionStorage.removeItem(STORAGE_KEYS.activeAnalysis);
}
