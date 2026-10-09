import { ApiError } from "@/features/common/api";

/**
 * Map API / network errors to short attorney-facing messages.
 * Never expose stack traces.
 */
export function toUserFacingError(error: unknown, fallback: string): string {
  if (!error) return fallback;

  if (typeof error === "string" && error.trim()) {
    return sanitize(error);
  }

  // Validation messages are written for the user ("The uploaded CV was not
  // found. Upload it again."); keep them as they are.
  if (error instanceof ApiError && error.status === 400 && error.message) {
    return sanitize(error.message);
  }

  if (error instanceof Error) {
    const message = error.message || fallback;
    if (/401|unauthorized|session/i.test(message)) {
      return "Your session has expired. Please sign in again and retry.";
    }
    if (/403|forbidden/i.test(message)) {
      return "You do not have permission to perform this action.";
    }
    if (/404|not found/i.test(message)) {
      return "The requested investigation or report could not be found.";
    }
    if (/network|fetch|failed to fetch|timeout/i.test(message)) {
      return "A network problem interrupted this request. Check your connection and retry.";
    }
    if (/503|502|500|server/i.test(message)) {
      return "The research service is temporarily unavailable. Please retry shortly.";
    }
    return sanitize(message);
  }

  return fallback;
}

function sanitize(message: string): string {
  return message
    .replace(/\s+at\s+\S+.*/g, "")
    .replace(/Error:\s*/i, "")
    .trim()
    .slice(0, 280);
}
