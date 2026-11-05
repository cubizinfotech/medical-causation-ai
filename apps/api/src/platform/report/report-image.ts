/**
 * Cover photos must be JPEG/PNG for PDFKit and the Word renderer.
 * Practice sites often serve WebP; convert those so the cover is not dropped.
 */

export interface ReportFriendlyImage {
  mimeType: 'image/jpeg' | 'image/png';
  bytes: Buffer;
}

/** Convert image bytes into a PDF/Word-safe JPEG or PNG. */
export async function toReportFriendlyImage(input: {
  mimeType: string;
  bytes: Buffer;
}): Promise<ReportFriendlyImage | null> {
  if (input.bytes.length < 32) return null;
  if (input.mimeType === 'image/jpeg' || input.mimeType === 'image/png') {
    return { mimeType: input.mimeType, bytes: input.bytes };
  }
  if (input.mimeType !== 'image/webp') return null;
  try {
    const { loadImage, createCanvas } = await import('@napi-rs/canvas');
    const image = await loadImage(input.bytes);
    const width = Math.max(1, image.width);
    const height = Math.max(1, image.height);
    const canvas = createCanvas(width, height);
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    return { mimeType: 'image/png', bytes: canvas.toBuffer('image/png') };
  } catch {
    return null;
  }
}

/** Normalize a cover data-URL so PDF/Word can embed it. */
export async function normalizeCoverImageDataUrl(
  dataUrl: string | undefined,
): Promise<string | undefined> {
  if (!dataUrl?.startsWith('data:image/')) return dataUrl;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl;
  const header = dataUrl.slice(0, comma);
  const mime = header.match(/^data:(image\/[a-z0-9.+-]+)/i)?.[1]?.toLowerCase();
  if (!mime) return dataUrl;
  if (mime === 'image/jpeg' || mime === 'image/png') return dataUrl;
  try {
    const bytes = Buffer.from(dataUrl.slice(comma + 1), 'base64');
    const friendly = await toReportFriendlyImage({ mimeType: mime, bytes });
    if (!friendly) return undefined;
    return `data:${friendly.mimeType};base64,${friendly.bytes.toString('base64')}`;
  } catch {
    return undefined;
  }
}
