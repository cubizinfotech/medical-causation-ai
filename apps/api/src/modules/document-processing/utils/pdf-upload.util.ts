import { BadRequestException } from '@nestjs/common';
import { TooManyPagesException } from '../exceptions';
import { PdfParser } from '../parsers/pdf.parser';

/** Pages with less text than this are treated as scanned or blank. */
export const MIN_READABLE_PAGE_CHARS = 30;

/**
 * A page with less text than this that also shows an image is read with OCR:
 * typically a scan with only a fax header or stamp as real text.
 */
export const OCR_IMAGE_PAGE_MAX_CHARS = 300;

/** The multer file shape the upload endpoints read (memory storage). */
export interface UploadedPdfFile {
  originalname: string;
  size: number;
  buffer: Buffer;
}

export interface PdfUploadRules {
  maxFileSizeBytes: number;
  maxPages: number;
  ocrEnabled: boolean;
  /** Shown in "Only … can be uploaded." */
  label: string;
  /** Appended to the page-limit message, e.g. " per analysis". */
  pageLimitScope?: string;
}

export interface ReadPdfUpload {
  name: string;
  pages: Array<{ pageNumber: number; text: string }>;
  /** Pages to read with OCR (or that stay unread without it). */
  unreadablePages: number[];
}

/** Checks the size and the actual bytes, not the name or browser type. */
export function assertPdfUpload(
  file: UploadedPdfFile | undefined,
  rules: Pick<PdfUploadRules, 'maxFileSizeBytes' | 'label'>,
): asserts file is UploadedPdfFile {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Choose a PDF file to upload.');
  }
  if (file.size > rules.maxFileSizeBytes) {
    throw new BadRequestException(
      `The file is too large. The limit is ${Math.round(rules.maxFileSizeBytes / 1024 / 1024)} MB.`,
    );
  }
  if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new BadRequestException(`Only ${rules.label} can be uploaded.`);
  }
}

/** The uploaded name without folders or control characters, for display only. */
export function uploadDisplayName(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'document.pdf').slice(0, 200);
}

/**
 * Reads the page text of an uploaded PDF and lists the pages that need OCR.
 * The page limit is checked before any text is read.
 */
export async function readPdfUpload(
  file: UploadedPdfFile,
  rules: PdfUploadRules,
): Promise<ReadPdfUpload> {
  const name = uploadDisplayName(file.originalname);
  let pages: Array<{ pageNumber: number; text: string; hasImages?: boolean }>;
  try {
    const parsed = await new PdfParser().parse({
      filePath: '',
      buffer: file.buffer,
      filename: name,
      extension: 'pdf',
      fileSize: file.size,
      createdAt: new Date(),
      modifiedAt: new Date(),
      maxPages: rules.maxPages,
    });
    pages = parsed.pages;
  } catch (error) {
    if (error instanceof TooManyPagesException) {
      throw new BadRequestException(
        `This PDF has ${error.pageCount} pages. The limit is ${error.maxPages} pages${rules.pageLimitScope ?? ''}.`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new BadRequestException(
      /password/i.test(message)
        ? 'This PDF is password-protected. Remove the password and upload it again.'
        : 'This file could not be read as a PDF. It may be damaged.',
    );
  }

  // Without OCR only empty pages are unread. With OCR, scans that carry a
  // little real text (a fax header, a stamp) are read from the image too.
  const unreadablePages = pages
    .filter((page) => {
      const length = page.text.trim().length;
      if (length < MIN_READABLE_PAGE_CHARS) return true;
      return (
        rules.ocrEnabled &&
        page.hasImages === true &&
        length < OCR_IMAGE_PAGE_MAX_CHARS
      );
    })
    .map((page) => page.pageNumber);
  if (unreadablePages.length === pages.length && !rules.ocrEnabled) {
    throw new BadRequestException(
      'No readable text was found. This looks like a scanned PDF, and reading scanned pages (OCR) is turned off on this server.',
    );
  }
  return { name, pages, unreadablePages };
}
