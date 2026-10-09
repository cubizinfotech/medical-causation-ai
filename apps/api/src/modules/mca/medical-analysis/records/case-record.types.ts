/** Pages with less text than this are treated as scanned or blank. */
export const MIN_READABLE_PAGE_CHARS = 30;

/**
 * A page with less text than this that also shows an image is read with OCR:
 * typically a scan with only a fax header or stamp as real text.
 */
export const OCR_IMAGE_PAGE_MAX_CHARS = 300;

/** The multer file shape this module reads (memory storage). */
export interface UploadedRecordFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** What the upload endpoint returns to the case form. */
export interface CaseRecordSummary {
  id: string;
  name: string;
  sizeBytes: number;
  pageCount: number;
  /** Pages with usable text now; the chronology is built from these. */
  readablePages: number;
  /** Pages that will not be read: blank pages, or scanned pages when OCR is off. */
  unreadablePages: number[];
  /** Scanned pages that will be read with OCR when the analysis runs. */
  ocrPendingPages: number[];
  /** Pages already read with OCR. */
  ocrPages: number[];
  createdAt: string;
}

export interface CaseRecordPageText {
  pageNumber: number;
  text: string;
  batesNumbers: string[];
  /** OCR confidence (0–100) when the text was read from a scanned image. */
  ocrConfidence?: number | null;
}

/** A record with its page text, as the analysis job reads it. */
export interface LoadedCaseRecord {
  id: string;
  name: string;
  pageCount: number;
  unreadablePages: number[];
  ocrPages: number[];
  pages: CaseRecordPageText[];
}

/** What the OCR step did, for progress messages and report warnings. */
export interface ScannedPagesResult {
  /** Pages that were sent to OCR. */
  attempted: number;
  /** Pages that came back with usable text. */
  read: number;
  /** Set when OCR could not run at all; the pages stay unread. */
  error?: string;
}
