/**
 * Builds a small text PDF for tests: one entry per page, each a list of
 * lines. An empty list gives a page with no text layer (like a scan).
 */
export function makeTestPdf(pages: string[][]): Buffer {
  const escape = (line: string) =>
    line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const fontId = 3;
  const pageIds = pages.map((_, i) => 4 + i * 2);
  const objects = new Map<number, string>();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  );
  objects.set(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  pages.forEach((lines, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const stream = lines.length
      ? `BT /F1 11 Tf 14 TL 50 740 Td ${lines.map((l) => `(${escape(l)}) '`).join(' ')} ET`
      : '';
    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    objects.set(
      contentId,
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    );
  });

  const count = Math.max(...objects.keys());
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id <= count; id++) {
    offsets[id] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= count; id++) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
