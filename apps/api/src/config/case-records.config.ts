import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { CaseRecordsSettings } from './config.types';

/** The monorepo root: the nearest package.json that declares workspaces. */
export function findRepositoryRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 4; i++) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, 'utf8')) as {
          workspaces?: unknown;
        };
        if (parsed.workspaces) return dir;
      } catch {
        // Keep walking up.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export const caseRecordsConfig = (): CaseRecordsSettings => {
  const root = findRepositoryRoot();
  const configured = process.env.CASE_RECORDS_PATH?.trim();
  return {
    // Outside the web root and the knowledge base: these are patient records.
    storagePath: configured
      ? isAbsolute(configured)
        ? configured
        : resolve(root, configured)
      : join(root, 'data', 'case-records'),
    maxFileSizeBytes:
      Number(process.env.UPLOAD_MAX_SIZE_MB ?? 50) * 1024 * 1024,
    maxFilesPerCase: Number(process.env.MCA_RECORDS_MAX_FILES ?? 10),
    maxPagesPerCase: Number(process.env.MCA_RECORDS_MAX_PAGES ?? 200),
    chronologyBatchChars: Number(process.env.CHRONOLOGY_BATCH_CHARS ?? 12000),
    chronologyPromptChars: Number(process.env.CHRONOLOGY_PROMPT_CHARS ?? 10000),
    stagedTtlHours: Number(process.env.MCA_RECORDS_STAGED_TTL_HOURS ?? 24),
    ocrEnabled: process.env.MCA_RECORDS_OCR !== 'false',
    ocrDpi: Number(process.env.MCA_RECORDS_OCR_DPI ?? 200),
    ocrLowConfidence: Number(process.env.MCA_RECORDS_OCR_LOW_CONFIDENCE ?? 60),
  };
};
