import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import {
  DocumentProcessingService,
  evaluateDocumentStorage,
  type ProcessedDocumentResult,
} from '@modules/document-processing';
import { inferEwiDocumentKind } from './ewi-document-kind.util';
import type {
  EwiDocumentKind,
  EwiEvidenceDocument,
  EwiEvidenceReference,
} from './ewi-evidence-reference.types';

export interface EwiDocumentIntakeInput {
  filePath: string;
  filename?: string;
  investigationId?: string;
  documentId?: string;
  sourceUrl?: string;
  sourceProvider?: string;
  access?: 'public' | 'restricted' | 'unavailable';
  /** When false, public docs are still metadata-only. */
  storagePermitted?: boolean;
  kindHint?: EwiDocumentKind;
  categoryHint?: string;
}

/**
 * EWI document intake on top of the shared DocumentProcessingService.
 * Handles duplicates, storage policy, and evidence reference generation.
 */
@Injectable()
export class EwiDocumentIntakeService {
  private readonly logger = new Logger(EwiDocumentIntakeService.name);
  private readonly byChecksum = new Map<string, EwiEvidenceDocument>();
  private readonly byId = new Map<string, EwiEvidenceDocument>();

  constructor(private readonly documents: DocumentProcessingService) {}

  getDocument(documentId: string): EwiEvidenceDocument | undefined {
    return this.byId.get(documentId);
  }

  listDocuments(investigationId?: string): EwiEvidenceDocument[] {
    const all = [...this.byId.values()];
    if (!investigationId) return all;
    return all.filter((doc) => doc.investigationId === investigationId);
  }

  async ingest(input: EwiDocumentIntakeInput): Promise<EwiEvidenceDocument> {
    const filename =
      input.filename ?? input.filePath.split(/[/\\]/).pop() ?? 'document';
    const extension = filename.includes('.')
      ? filename.slice(filename.lastIndexOf('.') + 1)
      : '';

    const storage = evaluateDocumentStorage({
      filename,
      extension,
      sourceProvider: input.sourceProvider,
      sourceUrl: input.sourceUrl,
      access: input.access,
      storagePermitted: input.storagePermitted,
    });

    // Lexis / restricted PDFs: do not run full body persistence path.
    if (storage.decision === 'rejected') {
      const documentId =
        input.documentId ?? `ewi-doc-${checksumOf(filename + Date.now())}`;
      const rejected: EwiEvidenceDocument = {
        documentId,
        investigationId: input.investigationId,
        kind:
          input.kindHint ??
          inferEwiDocumentKind({
            filename,
            categoryHint: input.categoryHint,
          }),
        title: filename,
        filename,
        checksum: '',
        sourceUrl: input.sourceUrl ?? null,
        sourceProvider: input.sourceProvider ?? null,
        access: input.access ?? 'restricted',
        storageStatus: 'rejected',
        ocrStatus: 'skipped',
        ocrAttempted: false,
        pageCount: 0,
        pageReferences: [],
        batesNumbers: [],
        normalizedText: '',
        warnings: [storage.reason],
        duplicateOfDocumentId: null,
        processedAt: new Date().toISOString(),
        evidenceReferences: [
          {
            evidenceId: `${documentId}:meta`,
            documentId,
            documentTitle: filename,
            documentKind:
              input.kindHint ??
              inferEwiDocumentKind({
                filename,
                categoryHint: input.categoryHint,
              }),
            pageNumber: null,
            batesNumber: null,
            sourceUrl: input.sourceUrl ?? null,
            excerpt: null,
            ocrStatus: 'skipped',
            storageStatus: 'rejected',
          },
        ],
      };
      this.byId.set(documentId, rejected);
      this.logger.warn(`Rejected storage for ${filename}: ${storage.reason}`);
      return rejected;
    }

    const processed = await this.documents.processDocument(
      {
        filePath: input.filePath,
        documentId: input.documentId,
        relativePath: filename,
        sourceUrl: input.sourceUrl,
        sourceProvider: input.sourceProvider,
        access: input.access,
      },
      { skipValidation: true },
    );

    return this.registerProcessed(processed, input, storage.decision);
  }

  /**
   * Register an already-processed document (tests / pipeline reuse).
   */
  registerProcessed(
    processed: ProcessedDocumentResult,
    input: EwiDocumentIntakeInput,
    storageDecision:
      'store_allowed' | 'metadata_only' | 'rejected' = 'store_allowed',
  ): EwiEvidenceDocument {
    const checksum = processed.metadata.checksum ?? '';
    if (checksum && this.byChecksum.has(checksum)) {
      const existing = this.byChecksum.get(checksum)!;
      const duplicate: EwiEvidenceDocument = {
        ...existing,
        documentId: input.documentId ?? `dup-${existing.documentId}`,
        duplicateOfDocumentId: existing.documentId,
        warnings: [
          ...existing.warnings,
          `Duplicate of document ${existing.documentId} (checksum match).`,
        ],
        processedAt: new Date().toISOString(),
      };
      this.byId.set(duplicate.documentId, duplicate);
      return duplicate;
    }

    const documentId =
      processed.documentId ||
      input.documentId ||
      `ewi-doc-${checksum.slice(0, 12) || Date.now()}`;
    const kind =
      input.kindHint ??
      inferEwiDocumentKind({
        filename: processed.metadata.filename,
        categoryHint: input.categoryHint,
      });

    const storageStatus =
      storageDecision === 'store_allowed'
        ? ('stored' as const)
        : storageDecision === 'metadata_only'
          ? ('metadata_only' as const)
          : ('rejected' as const);

    const evidenceReferences = buildEvidenceReferences({
      documentId,
      title: processed.metadata.title,
      kind,
      sourceUrl: input.sourceUrl ?? null,
      processed,
      storageStatus,
    });

    const document: EwiEvidenceDocument = {
      documentId,
      investigationId: input.investigationId,
      kind,
      title: processed.metadata.title,
      filename: processed.metadata.filename,
      checksum,
      sourceUrl: input.sourceUrl ?? null,
      sourceProvider: input.sourceProvider ?? null,
      access: input.access ?? 'public',
      storageStatus,
      ocrStatus: processed.metadata.ocrStatus,
      ocrAttempted: processed.ocrAttempted,
      pageCount: processed.metadata.pageCount,
      pageReferences: processed.pageReferences,
      batesNumbers: processed.batesNumbers,
      normalizedText:
        storageStatus === 'stored' ? processed.normalizedText : '',
      warnings: processed.warnings,
      duplicateOfDocumentId: null,
      processedAt: processed.processedAt.toISOString(),
      evidenceReferences,
    };

    this.byId.set(documentId, document);
    if (checksum) this.byChecksum.set(checksum, document);
    return document;
  }

  clear(): void {
    this.byChecksum.clear();
    this.byId.clear();
  }
}

function buildEvidenceReferences(input: {
  documentId: string;
  title: string;
  kind: EwiDocumentKind;
  sourceUrl: string | null;
  processed: ProcessedDocumentResult;
  storageStatus: EwiEvidenceReference['storageStatus'];
}): EwiEvidenceReference[] {
  const refs: EwiEvidenceReference[] = [];

  if (input.processed.pageReferences.length > 0) {
    for (const page of input.processed.pageReferences) {
      const pageBates = page.batesNumbers;
      if (pageBates.length === 0) {
        refs.push({
          evidenceId: `${input.documentId}:p${page.pageNumber}`,
          documentId: input.documentId,
          documentTitle: input.title,
          documentKind: input.kind,
          pageNumber: page.pageNumber,
          batesNumber: null,
          sourceUrl: input.sourceUrl,
          excerpt: excerptForPage(input.processed, page.pageNumber),
          ocrStatus: input.processed.metadata.ocrStatus,
          storageStatus: input.storageStatus,
        });
      } else {
        for (const bates of pageBates) {
          refs.push({
            evidenceId: `${input.documentId}:p${page.pageNumber}:${bates}`,
            documentId: input.documentId,
            documentTitle: input.title,
            documentKind: input.kind,
            pageNumber: page.pageNumber,
            batesNumber: bates,
            sourceUrl: input.sourceUrl,
            excerpt: excerptForPage(input.processed, page.pageNumber),
            ocrStatus: input.processed.metadata.ocrStatus,
            storageStatus: input.storageStatus,
          });
        }
      }
    }
    return refs;
  }

  // Non-paginated docs: document-level ref only (no fabricated pages).
  refs.push({
    evidenceId: `${input.documentId}:doc`,
    documentId: input.documentId,
    documentTitle: input.title,
    documentKind: input.kind,
    pageNumber: null,
    batesNumber: input.processed.batesNumbers[0] ?? null,
    sourceUrl: input.sourceUrl,
    excerpt: input.processed.normalizedText.slice(0, 240) || null,
    ocrStatus: input.processed.metadata.ocrStatus,
    storageStatus: input.storageStatus,
  });
  return refs;
}

function excerptForPage(
  processed: ProcessedDocumentResult,
  pageNumber: number,
): string | null {
  const page = processed.pages.find((item) => item.pageNumber === pageNumber);
  if (!page?.text?.trim()) return null;
  return page.text.trim().slice(0, 240);
}

function checksumOf(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

/** Test helper — compute checksum without going through intake. */
export async function fileChecksum(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}
