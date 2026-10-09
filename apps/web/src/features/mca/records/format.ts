export { formatFileSize, formatPageList } from "@/features/common/format";

/** "2024-08-14" -> "Aug 14, 2024"; partial dates stay partial. */
export function formatEventDate(date: string): string {
  if (!date) return "Date not stated";
  const [year, month, day] = date.split("-").map(Number);
  if (day) {
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
    );
  }
  if (month) {
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return String(year);
}
