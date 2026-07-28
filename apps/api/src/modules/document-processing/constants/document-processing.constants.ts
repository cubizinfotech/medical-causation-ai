/**
 * Supported document parser identifiers.
 */
export const PARSER_TYPES = {
  PDF: 'pdf',
  DOCX: 'docx',
  TXT: 'txt',
  MARKDOWN: 'markdown',
  /** Future parsers */
  IMAGE: 'image',
  OCR: 'ocr',
  HTML: 'html',
  EPUB: 'epub',
} as const;

export type ParserType = (typeof PARSER_TYPES)[keyof typeof PARSER_TYPES];

/**
 * Extensions handled by the document processing pipeline.
 */
export const PROCESSABLE_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'] as const;

export type ProcessableExtension = (typeof PROCESSABLE_EXTENSIONS)[number];

/** Map file extension to parser type */
export const EXTENSION_PARSER_MAP: Record<ProcessableExtension, ParserType> = {
  pdf: PARSER_TYPES.PDF,
  docx: PARSER_TYPES.DOCX,
  txt: PARSER_TYPES.TXT,
  md: PARSER_TYPES.MARKDOWN,
};

/**
 * Minimum extracted character count to consider a PDF as text-based (not scanned).
 * Below this threshold, `needsOcr` is set to true for future OCR fallback.
 */
export const OCR_TEXT_THRESHOLD_CHARS = 50;

/**
 * Average characters per page below which a PDF is likely scanned.
 */
export const OCR_MIN_CHARS_PER_PAGE = 20;

/**
 * Characters per token estimate for metadata (same as AI module).
 */
export const CHARS_PER_TOKEN_ESTIMATE = 4;
