import { loadPdfjs } from '../../modules/document-processing/parsers/load-pdfjs';

/** Text of the first pages of a PDF (court orders, CVs, brochures). */
export async function extractPdfText(
  bytes: Uint8Array,
  maxPages = 25,
): Promise<{ title: string | null; text: string; pages: number }> {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  });
  const document = await task.promise;
  try {
    const pages: string[] = [];
    const limit = Math.min(document.numPages, maxPages);
    for (let number = 1; number <= limit; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .map((item) =>
            'str' in item && typeof item.str === 'string' ? item.str : '',
          )
          .join(' ')
          // eslint-disable-next-line no-control-regex
          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
          .replace(/[ \t]+/g, ' ')
          .trim(),
      );
      page.cleanup();
    }
    let title: string | null = null;
    try {
      const meta = await document.getMetadata();
      const info = meta?.info as Record<string, string> | undefined;
      title = info?.Title?.trim() || null;
    } catch {
      title = null;
    }
    return {
      title,
      text: pages.filter(Boolean).join('\n'),
      pages: document.numPages,
    };
  } finally {
    await document.destroy().catch(() => undefined);
  }
}
