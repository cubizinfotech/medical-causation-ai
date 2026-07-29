/** Stable locale for SSR + client (avoids hydration mismatch). */
const REPORT_DATE_LOCALE = "en-US";

export function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleString(REPORT_DATE_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
