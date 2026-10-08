import {
  caseFormDefaults,
  type CaseFormValues,
} from "../schemas/case-form.schema";
import type {
  CaseRecordSummary,
  MedicalAnalysisResult,
} from "@/features/mca/medical-analysis/types";
import { isBrowser } from "@/lib/config/env";

const CASE_FIELDS = Object.keys(caseFormDefaults) as (keyof CaseFormValues)[];

export const STORAGE_KEYS = {
  case: "mca:case-form",
  caseRecords: "mca:case-records",
  analysisResult: "mca:analysis-result",
  activeAnalysis: "mca:active-analysis",
} as const;

export interface ActiveAnalysisSession {
  caseId: string;
  jobId: string;
}

/** Keeps only intake fields. Drops legacy keys such as patientName. */
export function normalizeCaseForm(
  values: Partial<CaseFormValues> | null | undefined,
): CaseFormValues {
  const next = { ...caseFormDefaults };
  if (!values) return next;
  for (const key of CASE_FIELDS) {
    const value = values[key];
    if (typeof value === "string") {
      next[key] = value;
    }
  }
  return next;
}

export function saveCaseForm(values: Partial<CaseFormValues>): void {
  if (!isBrowser()) return;
  const next = { ...(loadCaseForm() ?? caseFormDefaults) };
  for (const key of CASE_FIELDS) {
    const value = values[key];
    if (typeof value === "string") {
      next[key] = value;
    }
  }
  sessionStorage.setItem(STORAGE_KEYS.case, JSON.stringify(next));
}

export function loadCaseForm(): CaseFormValues | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(STORAGE_KEYS.case);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return normalizeCaseForm(parsed as Partial<CaseFormValues>);
  } catch {
    return null;
  }
}

/** Uploaded records waiting for the next analysis (ids stay valid ~24 h). */
export function saveCaseRecords(records: CaseRecordSummary[]): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(STORAGE_KEYS.caseRecords, JSON.stringify(records));
}

export function loadCaseRecords(): CaseRecordSummary[] {
  if (!isBrowser()) return [];
  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem(STORAGE_KEYS.caseRecords) ?? "[]",
    );
    return Array.isArray(parsed)
      ? (parsed as CaseRecordSummary[]).filter(
          (record) => typeof record?.id === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** After an analysis starts, its records belong to it and cannot be reused. */
export function clearCaseRecords(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(STORAGE_KEYS.caseRecords);
}

export function saveAnalysisResult(result: MedicalAnalysisResult): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(STORAGE_KEYS.analysisResult, JSON.stringify(result));
}

export function loadAnalysisResult(): MedicalAnalysisResult | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(STORAGE_KEYS.analysisResult);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MedicalAnalysisResult;
  } catch {
    return null;
  }
}

export function clearAnalysisResult(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(STORAGE_KEYS.analysisResult);
}

export function saveActiveAnalysis(session: ActiveAnalysisSession): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(
    STORAGE_KEYS.activeAnalysis,
    JSON.stringify(session),
  );
}

export function loadActiveAnalysis(): ActiveAnalysisSession | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(STORAGE_KEYS.activeAnalysis);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveAnalysisSession;
  } catch {
    return null;
  }
}

export function clearActiveAnalysis(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(STORAGE_KEYS.activeAnalysis);
}

/** Clears transient demo session data after analysis completes or is abandoned. */
export function clearDemoSessionCache(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(STORAGE_KEYS.analysisResult);
  sessionStorage.removeItem(STORAGE_KEYS.activeAnalysis);
  sessionStorage.removeItem(STORAGE_KEYS.caseRecords);
}
