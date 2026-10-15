const GENERIC_FAILURE =
  "The analysis did not complete. Please try again. If it keeps happening, contact support.";

/**
 * Text that comes from the server's internals rather than a message written
 * for the user. Analyses saved before plain failure messages existed still
 * hold such text, e.g. 'AI provider "gemini" is unavailable: …'.
 */
const TECHNICAL_TEXT =
  /chunkId|provider "|exception|ECONN|ETIMEDOUT|prisma|redis|knowledge base context|JSON|status code|stack|\bat\s+\S+\s*\(|Error:|\{|\}|invocation|undefined|null\b/i;

const NETWORK_TEXT = /failed to fetch|network ?error|load failed|networkerror/i;

/** The failure message to show for an analysis, never raw server internals. */
export function analysisFailureMessage(
  ...candidates: Array<string | null | undefined>
): string {
  const message = candidates.find((value) => value?.trim())?.trim();
  if (!message) return GENERIC_FAILURE;
  if (NETWORK_TEXT.test(message)) {
    return "A network problem interrupted the connection to the server. Check your connection and try again.";
  }
  if (TECHNICAL_TEXT.test(message)) return GENERIC_FAILURE;
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}
