import { createCanvas } from '@napi-rs/canvas';

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

/**
 * Builds a PDF whose pages are only images of text, like a scanned record:
 * no text layer at all. An empty list gives a blank white page. A header
 * adds one line of real text on top of the image, like a fax header.
 */
export function makeScannedTestPdf(
  pages: string[][],
  options: { header?: string } = {},
): Buffer {
  const width = 1275;
  const height = 1650;
  const images = pages.map((lines) => {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#111111';
    context.font = '30px serif';
    lines.forEach((line, index) =>
      context.fillText(line, 110, 160 + index * 48),
    );
    return canvas.toBuffer('image/jpeg', 85);
  });

  const fontId = 3;
  const pageIds = pages.map((_, i) => 4 + i * 3);
  const objects = new Map<number, string>();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const header = options.header
    ? ` BT /F1 9 Tf 40 770 Td (${options.header.replace(/[()\\]/g, '')}) Tj ET`
    : '';
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  );
  images.forEach((jpeg, i) => {
    const pageId = pageIds[i];
    const content = `q 612 0 0 792 0 0 cm /Im1 Do Q${header}`;
    objects.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${pageId + 1} 0 R /Resources << /XObject << /Im1 ${pageId + 2} 0 R >> /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    objects.set(
      pageId + 1,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
    objects.set(
      pageId + 2,
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n${jpeg.toString('latin1')}\nendstream`,
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
