const EXTENSION_BY_TYPE: Record<string, string> = {
  "application/pdf": ".pdf",
};

/**
 * The name to save a downloaded report under: the server's name from
 * Content-Disposition when the browser can read it, otherwise `fallback`.
 * The extension follows the file's type, so a report saved as Word and
 * rebuilt as a PDF on download is not saved as ".docx".
 */
export function reportDownloadName(
  contentDisposition: string | null,
  fallback: string,
  mimeType: string,
): string {
  const name =
    fromContentDisposition(contentDisposition) || fallback.trim() || "ewi-report";
  const extension = EXTENSION_BY_TYPE[mimeType.split(";")[0].trim().toLowerCase()];
  const safe = name.replace(/[\\/]/g, "_");
  if (!extension || safe.toLowerCase().endsWith(extension)) return safe;
  return `${safe.replace(/\.[a-z0-9]{1,8}$/i, "")}${extension}`;
}

function fromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // Fall through to the plain parameter.
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/.exec(header);
  return (plain?.[1] ?? plain?.[2])?.trim() || null;
}
