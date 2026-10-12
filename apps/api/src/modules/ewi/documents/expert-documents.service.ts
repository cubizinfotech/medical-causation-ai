import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ExpertDocument } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import type { EwiDocumentsSettings } from '@config/config.types';
import { ewiDocumentsConfig } from '@config/ewi-documents.config';
import { PdfPageOcr } from '@modules/document-processing/ocr/pdf-page-ocr';
import {
  MIN_READABLE_PAGE_CHARS,
  assertPdfUpload,
  readPdfUpload,
} from '@modules/document-processing/utils/pdf-upload.util';
import { LocalFileStorage } from '@platform/storage/local-file-storage';
import type {
  ExpertDocumentKind,
  ExpertDocumentSummary,
  LoadedExpertDocument,
  UploadedExpertFile,
} from './expert-documents.types';

/** Staged uploads one user may hold before starting an investigation. */
const MAX_STAGED_PER_USER = 20;

/**
 * Documents an attorney uploads for an investigation (the opposing expert's
 * CV). Reads and deletes are scoped to the uploading user; files live
 * outside the web root under their id.
 */
@Injectable()
export class ExpertDocumentsService {
  private readonly logger = new Logger(ExpertDocumentsService.name);
  private readonly settings: EwiDocumentsSettings;
  private readonly storage: LocalFileStorage;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly ocr: PdfPageOcr,
  ) {
    this.settings =
      config.get<EwiDocumentsSettings>('ewiDocuments') ?? ewiDocumentsConfig();
    this.storage = new LocalFileStorage(this.settings.storagePath);
  }

  get batchChars(): number {
    return this.settings.batchChars;
  }

  async upload(
    ownerUserId: string,
    file: UploadedExpertFile | undefined,
    kind: ExpertDocumentKind = 'cv',
  ): Promise<ExpertDocumentSummary> {
    const rules = {
      maxFileSizeBytes: this.settings.maxFileSizeBytes,
      maxPages: this.settings.maxPages,
      ocrEnabled: this.settings.ocrEnabled,
      label: 'PDF files',
    };
    assertPdfUpload(file, rules);

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await this.prisma.expertDocument.findFirst({
      where: { ownerUserId, sha256, kind, investigationId: null },
    });
    if (duplicate) return this.toSummary(duplicate);

    // Checked before parsing too, so a user at the limit costs no PDF work.
    await this.assertStagedCapacity(ownerUserId);
    const { name, pages, unreadablePages } = await readPdfUpload(file, rules);

    const id = randomUUID();
    const storageKey = this.storage.keyFor(ownerUserId, id);
    await this.storage.write(storageKey, file.buffer);
    try {
      const document = await this.prisma.$transaction(async (tx) => {
        // One upload at a time per user, so parallel uploads cannot pass
        // the staged limit together.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerUserId}))`;
        await this.assertStagedCapacity(ownerUserId, tx);
        return tx.expertDocument.create({
          data: {
            id,
            ownerUserId,
            kind,
            originalName: name,
            byteSize: file.size,
            sha256,
            storageKey,
            pageCount: pages.length,
            unreadablePages,
            pages: {
              create: pages.map((page) => ({
                pageNumber: page.pageNumber,
                text: page.text,
              })),
            },
          },
        });
      });
      return this.toSummary(document);
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  /** The PDF, for the owner only (staged or attached to their investigation). */
  async readFile(
    ownerUserId: string,
    id: string,
  ): Promise<{ buffer: Buffer; name: string }> {
    const document = await this.findOwned(ownerUserId, id);
    return {
      buffer: await this.storage.read(document.storageKey),
      name: document.originalName,
    };
  }

  async deleteStaged(ownerUserId: string, id: string): Promise<void> {
    const document = await this.findOwned(ownerUserId, id);
    if (document.investigationId) {
      throw new BadRequestException(
        'This document belongs to an investigation. Delete the investigation to remove it.',
      );
    }
    await this.prisma.expertDocument.delete({ where: { id } });
    await this.storage.remove(document.storageKey);
  }

  /** Checked before an investigation is created for this document. */
  async assertOwned(ownerUserId: string, id: string): Promise<void> {
    const document = await this.prisma.expertDocument.findFirst({
      where: { id, ownerUserId },
      select: { id: true },
    });
    if (!document) {
      throw new BadRequestException(
        'The uploaded CV was not found. Upload it again.',
      );
    }
  }

  /**
   * Attaches the owner's document to an investigation and returns the id
   * attached. A document another of their investigations already uses (a
   * retry or a re-run) is copied, so each investigation keeps and deletes
   * its own file.
   */
  async attachToInvestigation(
    ownerUserId: string,
    id: string,
    investigationId: string,
  ): Promise<string> {
    const claimed = await this.prisma.expertDocument.updateMany({
      where: { id, ownerUserId, investigationId: null },
      data: { investigationId },
    });
    if (claimed.count === 1) return id;

    const notFound = new BadRequestException(
      'The uploaded CV was not found. Upload it again.',
    );
    const source = await this.prisma.expertDocument.findFirst({
      where: { id, ownerUserId },
      include: { pages: true },
    });
    if (!source) throw notFound;
    const buffer = await this.storage
      .read(source.storageKey)
      .catch((): never => {
        throw notFound;
      });
    const copyId = randomUUID();
    const storageKey = this.storage.keyFor(ownerUserId, copyId);
    await this.storage.write(storageKey, buffer);
    try {
      // The page text (with any OCR already done) is copied too.
      await this.prisma.expertDocument.create({
        data: {
          id: copyId,
          ownerUserId,
          investigationId,
          kind: source.kind,
          originalName: source.originalName,
          byteSize: source.byteSize,
          sha256: source.sha256,
          storageKey,
          pageCount: source.pageCount,
          unreadablePages: source.unreadablePages,
          ocrPages: source.ocrPages,
          ocrCompletedAt: source.ocrCompletedAt,
          pages: {
            create: source.pages.map((page) => ({
              pageNumber: page.pageNumber,
              text: page.text,
              ocrConfidence: page.ocrConfidence,
            })),
          },
        },
      });
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
    return copyId;
  }

  /**
   * Reads scanned pages with OCR once per file; the text is saved with the
   * page. Never throws: unread pages are reported with the CV check.
   */
  async readScannedPages(
    id: string,
    onProgress?: (done: number, total: number) => Promise<void>,
  ): Promise<{ attempted: number; read: number; error?: string }> {
    const result: { attempted: number; read: number; error?: string } = {
      attempted: 0,
      read: 0,
    };
    if (!this.settings.ocrEnabled) return result;
    const document = await this.prisma.expertDocument.findFirst({
      where: { id, ocrCompletedAt: null },
      include: { pages: true },
    });
    if (!document || document.unreadablePages.length === 0) return result;
    try {
      const buffer = await this.storage.read(document.storageKey);
      const ocrPages = await this.ocr.recognize(
        buffer,
        document.unreadablePages,
        { dpi: this.settings.ocrDpi, onPage: onProgress },
      );
      result.attempted = ocrPages.length;
      const existing = new Map(
        document.pages.map((page) => [page.pageNumber, page.text]),
      );
      const improved = ocrPages.filter(
        (page) =>
          page.text.length >= MIN_READABLE_PAGE_CHARS &&
          page.text.length >
            (existing.get(page.pageNumber) ?? '').trim().length,
      );
      const improvedNumbers = new Set(improved.map((page) => page.pageNumber));
      result.read = improved.length;
      await this.prisma.$transaction([
        ...improved.map((page) =>
          this.prisma.expertDocumentPage.update({
            where: {
              documentId_pageNumber: {
                documentId: document.id,
                pageNumber: page.pageNumber,
              },
            },
            data: { text: page.text, ocrConfidence: page.confidence },
          }),
        ),
        this.prisma.expertDocument.update({
          where: { id: document.id },
          data: {
            unreadablePages: document.unreadablePages.filter(
              (pageNumber) =>
                !improvedNumbers.has(pageNumber) &&
                (existing.get(pageNumber) ?? '').trim().length <
                  MIN_READABLE_PAGE_CHARS,
            ),
            ocrPages: [...improvedNumbers].sort((a, b) => a - b),
            ocrCompletedAt: new Date(),
          },
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`OCR failed for expert document ${id}: ${message}`);
      result.error = 'Scanned pages of the CV could not be read with OCR.';
    }
    return result;
  }

  /** A document with its page text, or null when it no longer exists. */
  async loadDocument(id: string): Promise<LoadedExpertDocument | null> {
    const document = await this.prisma.expertDocument.findFirst({
      where: { id },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
    });
    if (!document) return null;
    return {
      id: document.id,
      kind: 'cv',
      name: document.originalName,
      pageCount: document.pageCount,
      unreadablePages: document.unreadablePages,
      ocrPages: document.ocrPages,
      pages: document.pages.map((page) => ({
        pageNumber: page.pageNumber,
        text: page.text,
        ocrConfidence: page.ocrConfidence,
      })),
    };
  }

  /** Deletes the files of an investigation's documents; rows go with it. */
  async deleteFilesForInvestigation(investigationId: string): Promise<void> {
    const documents = await this.prisma.expertDocument.findMany({
      where: { investigationId },
      select: { storageKey: true },
    });
    await Promise.all(
      documents.map((document) => this.storage.remove(document.storageKey)),
    );
  }

  /** Deletes uploads that never became part of an investigation. */
  async cleanupStaged(): Promise<number> {
    const cutoff = new Date(
      Date.now() - this.settings.stagedTtlHours * 60 * 60 * 1000,
    );
    const stale = await this.prisma.expertDocument.findMany({
      where: { investigationId: null, createdAt: { lt: cutoff } },
      select: { id: true, storageKey: true },
    });
    for (const document of stale) {
      await this.prisma.expertDocument
        .delete({ where: { id: document.id } })
        .catch(() => undefined);
      await this.storage.remove(document.storageKey);
    }
    return stale.length;
  }

  private async assertStagedCapacity(
    ownerUserId: string,
    db: Pick<PrismaService, 'expertDocument'> = this.prisma,
  ): Promise<void> {
    const staged = await db.expertDocument.count({
      where: { ownerUserId, investigationId: null },
    });
    if (staged >= MAX_STAGED_PER_USER) {
      throw new BadRequestException(
        'Too many documents are waiting. Start an investigation or remove some first.',
      );
    }
  }

  private async findOwned(
    ownerUserId: string,
    id: string,
  ): Promise<ExpertDocument> {
    const document = await this.prisma.expertDocument.findFirst({
      where: { id, ownerUserId },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  private toSummary(document: ExpertDocument): ExpertDocumentSummary {
    const ocrPending =
      this.settings.ocrEnabled && !document.ocrCompletedAt
        ? document.unreadablePages
        : [];
    return {
      id: document.id,
      kind: 'cv',
      name: document.originalName,
      sizeBytes: document.byteSize,
      pageCount: document.pageCount,
      readablePages: document.pageCount - document.unreadablePages.length,
      unreadablePages: ocrPending.length > 0 ? [] : document.unreadablePages,
      ocrPendingPages: ocrPending,
      createdAt: document.createdAt.toISOString(),
    };
  }
}
