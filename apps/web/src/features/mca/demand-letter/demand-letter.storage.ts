import type { DemandLetterFormValues } from "./demand-letter.schema";

/** The attorney's own details, reused for every letter (this browser only). */
const SENDER_KEY = "mca:demand-letter:sender";
/** A case's draft, kept only until the tab closes: it holds client details. */
const draftKey = (caseId: string) => `mca:demand-letter:draft:${caseId}`;

export type DemandLetterSender = Pick<
  DemandLetterFormValues,
  "attorneyName" | "firmName" | "firmAddress" | "attorneyPhone" | "attorneyEmail"
>;

const SENDER_FIELDS: Array<keyof DemandLetterSender> = [
  "attorneyName",
  "firmName",
  "firmAddress",
  "attorneyPhone",
  "attorneyEmail",
];

function read(storage: () => Storage, key: string): Record<string, unknown> {
  try {
    const raw = storage().getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function write(storage: () => Storage, key: string, value: unknown): void {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the form still works.
  }
}

/** Only string fields of the form are restored. */
function pickStrings(
  values: Record<string, unknown>,
): Partial<DemandLetterFormValues> {
  const picked: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" || typeof value === "boolean") {
      picked[key] = value;
    }
  }
  return picked as Partial<DemandLetterFormValues>;
}

export function loadSender(): Partial<DemandLetterSender> {
  if (typeof window === "undefined") return {};
  return pickStrings(read(() => window.localStorage, SENDER_KEY));
}

export function saveSender(values: DemandLetterFormValues): void {
  if (typeof window === "undefined") return;
  const sender = Object.fromEntries(
    SENDER_FIELDS.map((field) => [field, values[field]]),
  );
  write(() => window.localStorage, SENDER_KEY, sender);
}

export function loadDraft(caseId: string): Partial<DemandLetterFormValues> {
  if (typeof window === "undefined") return {};
  return pickStrings(read(() => window.sessionStorage, draftKey(caseId)));
}

export function saveDraft(caseId: string, values: DemandLetterFormValues): void {
  if (typeof window === "undefined") return;
  write(() => window.sessionStorage, draftKey(caseId), values);
}
