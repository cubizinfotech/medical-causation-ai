/** Pages with less text than this are treated as scanned or blank. */
export const MIN_READABLE_PAGE_CHARS = 30;

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
  /** Pages with a text layer; the chronology is built from these. */
  readablePages: number;
  /** Scanned or blank pages that cannot be read until OCR exists. */
  unreadablePages: number[];
  createdAt: string;
}

export interface CaseRecordPageText {
  pageNumber: number;
  text: string;
  batesNumbers: string[];
}

/** A record with its page text, as the analysis job reads it. */
export interface LoadedCaseRecord {
  id: string;
  name: string;
  pageCount: number;
  unreadablePages: number[];
  pages: CaseRecordPageText[];
}
