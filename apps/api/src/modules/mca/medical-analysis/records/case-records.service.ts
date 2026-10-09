import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CaseRecord } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import type { CaseRecordsSettings } from '@config/config.types';
import { caseRecordsConfig } from '@config/case-records.config';
import { PdfParser } from '@modules/document-processing/parsers/pdf.parser';
import { PdfPageOcr } from '@modules/document-processing/ocr/pdf-page-ocr';
import { detectBatesNumbers } from '@modules/document-processing/utils/bates-detection.util';
import { CaseRecordStorage } from './case-record.storage';
import {
  MIN_READABLE_PAGE_CHARS,
  OCR_IMAGE_PAGE_MAX_CHARS,
  type CaseRecordSummary,
  type LoadedCaseRecord,
  type ScannedPagesResult,
  type UploadedRecordFile,
} from './case-record.types';

/** Staged uploads one user may hold before starting an analysis. */
const MAX_STAGED_PER_USER = 30;

function displayName(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? 'record.pdf';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'record.pdf').slice(0, 200);
}

function parseFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/password/i.test(message)) {
    return 'This PDF is password-protected. Remove the password and upload it again.';
  }
  return 'This file could not be read as a PDF. It may be damaged.';
}

/**
 * Client medical records for MCA cases. Patient data: every read and delete
 * is scoped to the uploading user, and files live outside the web root.
 */
@Injectable()
export class CaseRecordsService {
  private readonly logger = new Logger(CaseRecordsService.name);
  private readonly settings: CaseRecordsSettings;
  private readonly storage: CaseRecordStorage;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly ocr: PdfPageOcr,
  ) {
    this.settings =
      config.get<CaseRecordsSettings>('caseRecords') ?? caseRecordsConfig();
    this.storage = new CaseRecordStorage(this.settings.storagePath);
  }

  get chronologySettings(): Pick<
    CaseRecordsSettings,
    'chronologyBatchChars' | 'chronologyPromptChars' | 'ocrLowConfidence'
  > {
    return {
      chronologyBatchChars: this.settings.chronologyBatchChars,
      chronologyPromptChars: this.settings.chronologyPromptChars,
      ocrLowConfidence: this.settings.ocrLowConfidence,
    };
  }

  get limits(): Pick<
    CaseRecordsSettings,
    'maxFileSizeBytes' | 'maxFilesPerCase' | 'maxPagesPerCase'
  > {
    return {
      maxFileSizeBytes: this.settings.maxFileSizeBytes,
      maxFilesPerCase: this.settings.maxFilesPerCase,
      maxPagesPerCase: this.settings.maxPagesPerCase,
    };
  }

  async upload(
    ownerUserId: string,
    file: UploadedRecordFile | undefined,
  ): Promise<CaseRecordSummary> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a PDF file to upload.');
    }
    if (file.size > this.settings.maxFileSizeBytes) {
      throw new BadRequestException(
        `The file is too large. The limit is ${Math.round(this.settings.maxFileSizeBytes / 1024 / 1024)} MB.`,
      );
    }
    // Check the bytes, not just the name or the browser's content type.
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException(
        'Only PDF medical records can be uploaded.',
      );
    }

    void this.cleanupStaged().catch(() => undefined);

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await this.prisma.caseRecord.findFirst({
      where: { ownerUserId, sha256, caseId: null },
    });
    if (duplicate) return this.toSummary(duplicate);

    const staged = await this.prisma.caseRecord.count({
      where: { ownerUserId, caseId: null },
    });
    if (staged >= MAX_STAGED_PER_USER) {
      throw new BadRequestException(
        'Too many records are waiting. Start an analysis or remove some records first.',
      );
    }

    const name = displayName(file.originalname);
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
      });
      pages = parsed.pages;
    } catch (error) {
      throw new BadRequestException(parseFailureMessage(error));
    }

    if (pages.length > this.settings.maxPagesPerCase) {
      throw new BadRequestException(
        `This PDF has ${pages.length} pages. The limit is ${this.settings.maxPagesPerCase} pages per analysis.`,
      );
    }
    // Without OCR only empty pages are unread. With OCR, scans that carry a
    // little real text (a fax header, a stamp) are read from the image too.
    const unreadablePages = pages
      .filter((page) => {
        const length = page.text.trim().length;
        if (length < MIN_READABLE_PAGE_CHARS) return true;
        return (
          this.settings.ocrEnabled &&
          page.hasImages === true &&
          length < OCR_IMAGE_PAGE_MAX_CHARS
        );
      })
      .map((page) => page.pageNumber);
    if (unreadablePages.length === pages.length && !this.settings.ocrEnabled) {
      throw new BadRequestException(
        'No readable text was found. This looks like a scanned PDF, and reading scanned pages (OCR) is turned off on this server.',
      );
    }

    const id = randomUUID();
    const storageKey = this.storage.keyFor(ownerUserId, id);
    await this.storage.write(storageKey, file.buffer);

    try {
      const record = await this.prisma.caseRecord.create({
        data: {
          id,
          ownerUserId,
          originalName: name,
          mimeType: 'application/pdf',
          byteSize: file.size,
          sha256,
          storageKey,
          pageCount: pages.length,
          unreadablePages,
          pages: {
            create: pages.map((page) => ({
              pageNumber: page.pageNumber,
              text: page.text,
              batesNumbers: detectBatesNumbers(page.text),
            })),
          },
        },
      });
      return this.toSummary(record);
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  async readFile(
    ownerUserId: string,
    id: string,
  ): Promise<{ buffer: Buffer; name: string }> {
    const record = await this.findOwned(ownerUserId, id);
    return {
      buffer: await this.storage.read(record.storageKey),
      name: record.originalName,
    };
  }

  /** Removes an upload that is not yet part of an analysis. */
  async deleteStaged(ownerUserId: string, id: string): Promise<void> {
    const record = await this.findOwned(ownerUserId, id);
    if (record.caseId) {
      throw new BadRequestException(
        'This record belongs to an analysis. Delete the analysis to remove it.',
      );
    }
    await this.prisma.caseRecord.delete({ where: { id } });
    await this.storage.remove(record.storageKey);
  }

  /** Validates records before an analysis is created for them. */
  async assertAttachable(ownerUserId: string, ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length > this.settings.maxFilesPerCase) {
      throw new BadRequestException(
        `Attach at most ${this.settings.maxFilesPerCase} records to one analysis.`,
      );
    }
    const records = await this.prisma.caseRecord.findMany({
      where: { id: { in: unique }, ownerUserId },
    });
    if (records.length !== unique.length) {
      throw new BadRequestException(
        'One or more records were not found. Upload them again.',
      );
    }
    if (records.some((record) => record.caseId)) {
      throw new BadRequestException(
        'One or more records already belong to another analysis. Upload them again.',
      );
    }
    const totalPages = records.reduce((sum, r) => sum + r.pageCount, 0);
    if (totalPages > this.settings.maxPagesPerCase) {
      throw new BadRequestException(
        `These records have ${totalPages} pages in total. The limit is ${this.settings.maxPagesPerCase} pages per analysis.`,
      );
    }
  }

  async attachToCase(
    ownerUserId: string,
    ids: string[],
    caseId: string,
  ): Promise<void> {
    await this.prisma.caseRecord.updateMany({
      where: { id: { in: ids }, ownerUserId, caseId: null },
      data: { caseId },
    });
  }

  /**
   * Reads scanned pages with OCR, once per file. Results are saved with the
   * page, so a later analysis of the same file does not repeat the work.
   * Never throws: pages that stay unread are reported by the chronology.
   */
  async readScannedPages(
    ids: string[],
    onProgress?: (done: number, total: number) => Promise<void>,
  ): Promise<ScannedPagesResult> {
    const result: ScannedPagesResult = { attempted: 0, read: 0 };
    if (!this.settings.ocrEnabled || ids.length === 0) return result;
    const records = await this.prisma.caseRecord.findMany({
      where: { id: { in: ids }, ocrCompletedAt: null },
      include: { pages: true },
    });
    const pending = records.filter(
      (record) => record.unreadablePages.length > 0,
    );
    const total = pending.reduce(
      (sum, record) => sum + record.unreadablePages.length,
      0,
    );
    let done = 0;
    for (const record of pending) {
      try {
        const buffer = await this.storage.read(record.storageKey);
        const ocrPages = await this.ocr.recognize(
          buffer,
          record.unreadablePages,
          {
            dpi: this.settings.ocrDpi,
            onPage: async () => {
              done += 1;
              await onProgress?.(done, total);
            },
          },
        );
        result.attempted += ocrPages.length;
        const existing = new Map(
          record.pages.map((page) => [page.pageNumber, page.text]),
        );
        // Keep the OCR text only where it says more than the text layer.
        const improved = ocrPages.filter(
          (page) =>
            page.text.length >= MIN_READABLE_PAGE_CHARS &&
            page.text.length >
              (existing.get(page.pageNumber) ?? '').trim().length,
        );
        const improvedNumbers = new Set(
          improved.map((page) => page.pageNumber),
        );
        const stillUnread = record.unreadablePages.filter(
          (pageNumber) =>
            !improvedNumbers.has(pageNumber) &&
            (existing.get(pageNumber) ?? '').trim().length <
              MIN_READABLE_PAGE_CHARS,
        );
        result.read += improved.length;
        await this.prisma.$transaction([
          ...improved.map((page) =>
            this.prisma.caseRecordPage.update({
              where: {
                recordId_pageNumber: {
                  recordId: record.id,
                  pageNumber: page.pageNumber,
                },
              },
              data: {
                text: page.text,
                batesNumbers: detectBatesNumbers(page.text),
                ocrConfidence: page.confidence,
              },
            }),
          ),
          this.prisma.caseRecord.update({
            where: { id: record.id },
            data: {
              unreadablePages: stillUnread,
              ocrPages: [...improvedNumbers].sort((a, b) => a - b),
              ocrCompletedAt: new Date(),
            },
          }),
        ]);
        const failed = ocrPages.filter((page) => page.error).length;
        if (failed > 0) {
          this.logger.warn(
            `OCR could not read ${failed} page(s) of record ${record.id}`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`OCR failed for record ${record.id}: ${message}`);
        result.error =
          'Scanned pages could not be read with OCR on this server.';
        done += record.unreadablePages.length;
        await onProgress?.(done, total);
      }
    }
    return result;
  }

  /** Records in the order they were attached, with page text. */
  async loadForAnalysis(ids: string[]): Promise<LoadedCaseRecord[]> {
    const records = await this.prisma.caseRecord.findMany({
      where: { id: { in: ids } },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
    });
    const byId = new Map(records.map((record) => [record.id, record]));
    return ids
      .map((id) => byId.get(id))
      .filter((record): record is NonNullable<typeof record> => !!record)
      .map((record) => ({
        id: record.id,
        name: record.originalName,
        pageCount: record.pageCount,
        unreadablePages: record.unreadablePages,
        ocrPages: record.ocrPages,
        pages: record.pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: page.text,
          batesNumbers: page.batesNumbers,
          ocrConfidence: page.ocrConfidence,
        })),
      }));
  }

  /** Deletes the files of a case's records; rows go with the case. */
  async deleteFilesForCase(caseId: string): Promise<void> {
    const records = await this.prisma.caseRecord.findMany({
      where: { caseId },
      select: { storageKey: true },
    });
    await Promise.all(records.map((r) => this.storage.remove(r.storageKey)));
  }

  /** Deletes uploads that never became part of an analysis. */
  async cleanupStaged(): Promise<number> {
    const cutoff = new Date(
      Date.now() - this.settings.stagedTtlHours * 60 * 60 * 1000,
    );
    const stale = await this.prisma.caseRecord.findMany({
      where: { caseId: null, createdAt: { lt: cutoff } },
      select: { id: true, storageKey: true },
    });
    for (const record of stale) {
      await this.prisma.caseRecord
        .delete({ where: { id: record.id } })
        .catch(() => undefined);
      await this.storage.remove(record.storageKey);
    }
    if (stale.length > 0) {
      this.logger.log(`Removed ${stale.length} unused staged record(s)`);
    }
    return stale.length;
  }

  private async findOwned(
    ownerUserId: string,
    id: string,
  ): Promise<CaseRecord> {
    const record = await this.prisma.caseRecord.findFirst({
      where: { id, ownerUserId },
    });
    if (!record) throw new NotFoundException('Record not found');
    return record;
  }

  private toSummary(record: CaseRecord): CaseRecordSummary {
    const ocrPending =
      this.settings.ocrEnabled && !record.ocrCompletedAt
        ? record.unreadablePages
        : [];
    return {
      id: record.id,
      name: record.originalName,
      sizeBytes: record.byteSize,
      pageCount: record.pageCount,
      readablePages: record.pageCount - record.unreadablePages.length,
      unreadablePages: ocrPending.length > 0 ? [] : record.unreadablePages,
      ocrPendingPages: ocrPending,
      ocrPages: record.ocrPages ?? [],
      createdAt: record.createdAt.toISOString(),
    };
  }
}
