import type { ExpertInvestigationFormValues } from "../schemas/expert-form.schema";
import type { CreateEwiJobResponse } from "../types";

const EXPERT_KEY = "ewi:expert-form";
const JOB_KEY = "ewi:active-job";

export function saveExpertForm(values: ExpertInvestigationFormValues): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(EXPERT_KEY, JSON.stringify(values));
}

export function loadExpertForm(): ExpertInvestigationFormValues | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(EXPERT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ExpertInvestigationFormValues;
  } catch {
    return null;
  }
}

export function saveActiveEwiJob(job: CreateEwiJobResponse): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(JOB_KEY, JSON.stringify(job));
}

export function loadActiveEwiJob(): CreateEwiJobResponse | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(JOB_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CreateEwiJobResponse;
  } catch {
    return null;
  }
}

export function clearActiveEwiJob(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(JOB_KEY);
}
