/** [1,2,3,7,9,10] -> "1–3, 7, 9–10" */
export function formatPageList(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    ranges.push(start === sorted[i] ? `${start}` : `${start}–${sorted[i]}`);
  }
  return ranges.join(", ");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
