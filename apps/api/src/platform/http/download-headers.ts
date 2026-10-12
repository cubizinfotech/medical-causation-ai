/**
 * Response headers for a file download. The file name is reduced to safe
 * ASCII for the plain parameter and kept in full (encoded) in filename*,
 * so a name with quotes, line breaks, or accents cannot break the header.
 */
export function downloadHeaders(
  fileName: string,
  mimeType: string,
  disposition: 'inline' | 'attachment' = 'attachment',
): Record<string, string> {
  const asciiName =
    fileName
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, "'")
      .trim() || 'download';
  return {
    'Content-Type': mimeType,
    'Content-Disposition': `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}
