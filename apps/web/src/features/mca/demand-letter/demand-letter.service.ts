import { apiFetch } from "@/lib/config";
import type { DemandLetterRequest } from "./demand-letter.schema";

async function errorMessage(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  const message =
    typeof payload === "object" && payload !== null && "message" in payload
      ? (payload as { message: unknown }).message
      : null;
  if (Array.isArray(message)) return message.join(" ");
  if (typeof message === "string") return message;
  return `The letter could not be drafted (${response.status}).`;
}

/** "Jane Q. Doe" -> "jane-q-doe" (matches the server's file name). */
function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "client"
  );
}

/**
 * Drafts the letter on the server and saves the Word file. Returns the file
 * name. The AI step can take up to a minute.
 */
export async function downloadDemandLetter(
  caseId: string,
  request: DemandLetterRequest,
): Promise<string> {
  const response = await apiFetch(
    `/medical-analysis/histories/${caseId}/demand-letter`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("The letter file was empty.");

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `demand-letter-${slugify(request.clientName)}-${today}.docx`;
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return fileName;
}
