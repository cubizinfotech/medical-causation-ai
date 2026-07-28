import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageSettings } from '@config/config.types';
import {
  DOCUMENT_STATUS,
  KNOWLEDGE_BASE_FOLDER_LIST,
  KNOWLEDGE_BASE_SECTIONS,
} from '../constants';
import type {
  DocumentListOptions,
  DocumentListResult,
  KnowledgeBaseRefreshResult,
  KnowledgeBaseSectionSummary,
  KnowledgeBaseStats,
  KnowledgeDocument,
} from '../types';
import type { IKnowledgeBaseService } from '../interfaces';
import { DocumentDiscoveryService } from './document-discovery.service';
import {
  findDuplicatesByChecksum,
  validateDocument as validateDocumentUtil,
} from '../utils';

/**
 * Main knowledge base management service.
 * Single entry point for document discovery, listing, and validation.
 */
@Injectable()
export class KnowledgeBaseService implements IKnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  private documents: Map<string, KnowledgeDocument> = new Map();
  private lastScannedAt: Date | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly discoveryService: DocumentDiscoveryService,
  ) {}

  private get storage(): StorageSettings {
    return this.configService.get<StorageSettings>('storage')!;
  }

  async discoverDocuments(): Promise<KnowledgeDocument[]> {
    return this.discoveryService.scan();
  }

  async listDocuments(
    options: DocumentListOptions = {},
  ): Promise<DocumentListResult> {
    await this.ensureIndexed();

    let results = Array.from(this.documents.values());

    if (options.folder) {
      results = results.filter((d) => d.folder === options.folder);
    }
    if (options.category) {
      results = results.filter((d) => d.category === options.category);
    }
    if (options.subCategory) {
      results = results.filter((d) => d.subCategory === options.subCategory);
    }
    if (options.status) {
      results = results.filter((d) => d.status === options.status);
    }
    if (options.extension) {
      results = results.filter(
        (d) => d.extension === options.extension!.toLowerCase(),
      );
    }
    if (options.search) {
      const query = options.search.toLowerCase();
      results = results.filter(
        (d) =>
          d.title.toLowerCase().includes(query) ||
          d.filename.toLowerCase().includes(query) ||
          d.relativePath.toLowerCase().includes(query),
      );
    }

    results.sort((a, b) => a.title.localeCompare(b.title));

    const total = results.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? total;
    const documents = results.slice(offset, offset + limit);

    return { documents, total, limit, offset };
  }

  async getDocument(id: string): Promise<KnowledgeDocument | null> {
    await this.ensureIndexed();
    return this.documents.get(id) ?? null;
  }

  updateDocumentStatus(
    id: string,
    status: KnowledgeDocument['status'],
  ): KnowledgeDocument | null {
    const existing = this.documents.get(id);
    if (!existing) return null;

    const updated = { ...existing, status };
    this.documents.set(id, updated);
    return updated;
  }

  async refreshKnowledgeBase(): Promise<KnowledgeBaseRefreshResult> {
    const startTime = Date.now();
    const scannedAt = new Date();
    const discovered = await this.discoveryService.scan();

    const previousIds = new Set(this.documents.keys());
    const discoveredIds = new Set(discovered.map((d) => d.id));
    let added = 0;
    let updated = 0;
    let ignored = 0;

    const checksums = new Set<string>();

    for (const doc of discovered) {
      const validation = this.validateDocument(doc, checksums);
      checksums.add(doc.checksum);

      if (!validation.valid) {
        ignored++;
        this.documents.set(doc.id, {
          ...doc,
          status: DOCUMENT_STATUS.IGNORED,
        });
        continue;
      }

      const existing = this.documents.get(doc.id);
      if (!existing) {
        added++;
        this.documents.set(doc.id, doc);
      } else if (existing.checksum !== doc.checksum) {
        updated++;
        this.documents.set(doc.id, {
          ...doc,
          status: DOCUMENT_STATUS.PENDING,
        });
      } else {
        this.documents.set(doc.id, {
          ...existing,
          discoveredAt: scannedAt,
          modifiedAt: doc.modifiedAt,
          size: doc.size,
        });
      }
    }

    let removed = 0;
    for (const id of previousIds) {
      if (!discoveredIds.has(id)) {
        this.documents.delete(id);
        removed++;
      }
    }

    const duplicates = findDuplicatesByChecksum(
      Array.from(this.documents.values()),
    ).size;

    this.lastScannedAt = scannedAt;

    const result: KnowledgeBaseRefreshResult = {
      discovered: discovered.length,
      added,
      updated,
      removed,
      ignored,
      duplicates,
      scannedAt,
      durationMs: Date.now() - startTime,
    };

    this.logger.log(
      `Knowledge base refreshed: ${added} added, ${updated} updated, ${removed} removed, ${ignored} ignored`,
    );

    return result;
  }

  validateDocument(
    document: KnowledgeDocument,
    existingChecksums: Set<string> = new Set(),
  ) {
    return validateDocumentUtil(document, this.storage, existingChecksums);
  }

  getStats(): KnowledgeBaseStats {
    const documents = Array.from(this.documents.values());

    const byFolder: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byExtension: Record<string, number> = {};

    for (const folder of KNOWLEDGE_BASE_FOLDER_LIST) {
      byFolder[folder] = 0;
    }

    let totalSizeBytes = 0;

    for (const doc of documents) {
      byFolder[doc.folder] = (byFolder[doc.folder] ?? 0) + 1;
      byCategory[doc.category] = (byCategory[doc.category] ?? 0) + 1;
      byExtension[doc.extension] = (byExtension[doc.extension] ?? 0) + 1;
      totalSizeBytes += doc.size;
    }

    const countByStatus = (status: string) =>
      documents.filter((d) => d.status === status).length;

    return {
      totalFiles: documents.length,
      indexedFiles: countByStatus(DOCUMENT_STATUS.INDEXED),
      pendingFiles: countByStatus(DOCUMENT_STATUS.PENDING),
      processingFiles: countByStatus(DOCUMENT_STATUS.PROCESSING),
      failedFiles: countByStatus(DOCUMENT_STATUS.FAILED),
      ignoredFiles: countByStatus(DOCUMENT_STATUS.IGNORED),
      byFolder,
      byCategory,
      byExtension,
      totalSizeBytes,
      lastScannedAt: this.lastScannedAt,
    };
  }

  getSectionSummaries(): KnowledgeBaseSectionSummary[] {
    const documents = Array.from(this.documents.values());

    return KNOWLEDGE_BASE_FOLDER_LIST.map((folder) => {
      const sectionDocs = documents.filter((d) => d.folder === folder);

      return {
        key: folder,
        label: KNOWLEDGE_BASE_SECTIONS[folder],
        count: sectionDocs.length,
        pendingCount: sectionDocs.filter(
          (d) => d.status === DOCUMENT_STATUS.PENDING,
        ).length,
        indexedCount: sectionDocs.filter(
          (d) => d.status === DOCUMENT_STATUS.INDEXED,
        ).length,
      };
    });
  }

  private async ensureIndexed(): Promise<void> {
    if (this.documents.size === 0) {
      await this.refreshKnowledgeBase();
    }
  }
}
