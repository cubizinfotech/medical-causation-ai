const EXTENSION_BY_TYPE: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

/**
 * The name to save a downloaded file under: the server's name from
 * Content-Disposition when the browser can read it, otherwise `fallback`.
 * The extension follows the file's type, so a report saved as Word and
 * rebuilt as a PDF on download is not saved as ".docx".
 */
export function downloadFileName(
  contentDisposition: string | null,
  fallback: string,
  mimeType: string,
): string {
  const name =
    fromContentDisposition(contentDisposition) || fallback.trim() || "report";
  const extension =
    EXTENSION_BY_TYPE[mimeType.split(";")[0].trim().toLowerCase()];
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

/** Saves a downloaded file in the browser (call it from a click handler). */
export function saveBlob(blob: Blob, fileName: string): void {
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
}
