import { isAbsolute, join, resolve } from 'node:path';
import { findRepositoryRoot } from './case-records.config';
import type { EwiDocumentsSettings } from './config.types';

export const ewiDocumentsConfig = (): EwiDocumentsSettings => {
  const root = findRepositoryRoot();
  const configured = process.env.EWI_DOCUMENTS_PATH?.trim();
  return {
    storagePath: configured
      ? isAbsolute(configured)
        ? configured
        : resolve(root, configured)
      : join(root, 'data', 'ewi-documents'),
    maxFileSizeBytes:
      Number(process.env.UPLOAD_MAX_SIZE_MB ?? 50) * 1024 * 1024,
    maxPages: Number(process.env.EWI_CV_MAX_PAGES ?? 80),
    stagedTtlHours: Number(process.env.MCA_RECORDS_STAGED_TTL_HOURS ?? 24),
    ocrEnabled: process.env.MCA_RECORDS_OCR !== 'false',
    ocrDpi: Number(process.env.MCA_RECORDS_OCR_DPI ?? 200),
    batchChars: Number(process.env.EWI_CV_BATCH_CHARS ?? 12000),
  };
};
