import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, readFile, stat } from 'fs/promises';
import type { Dirent } from 'fs';
import { join, relative } from 'path';
import type { StorageSettings } from '@config/config.types';
import {
  KNOWLEDGE_BASE_FOLDER_LIST,
  type KnowledgeBaseFolder,
} from '../constants';
import type { KnowledgeDocument } from '../types';
import type { IDocumentDiscoveryService } from '../interfaces';
import {
  buildDocumentMetadata,
  computeChecksum,
  getFileExtension,
  isSupportedExtension,
} from '../utils';

/**
 * Scans the knowledge-base directory tree and discovers supported documents.
 * Does not parse document contents — metadata and checksum only.
 */
@Injectable()
export class DocumentDiscoveryService implements IDocumentDiscoveryService {
  private readonly logger = new Logger(DocumentDiscoveryService.name);

  constructor(private readonly configService: ConfigService) {}

  private get storage(): StorageSettings {
    return this.configService.get<StorageSettings>('storage')!;
  }

  async scan(): Promise<KnowledgeDocument[]> {
    const documents: KnowledgeDocument[] = [];
    const discoveredAt = new Date();

    for (const folder of KNOWLEDGE_BASE_FOLDER_LIST) {
      const folderDocs = await this.scanFolderInternal(folder, discoveredAt);
      documents.push(...folderDocs);
    }

    this.logger.log(
      `Discovered ${documents.length} documents across ${KNOWLEDGE_BASE_FOLDER_LIST.length} folders`,
    );

    return documents;
  }

  async scanFolder(folder: string): Promise<KnowledgeDocument[]> {
    return this.scanFolderInternal(folder as KnowledgeBaseFolder, new Date());
  }

  private async scanFolderInternal(
    folder: KnowledgeBaseFolder,
    discoveredAt: Date,
  ): Promise<KnowledgeDocument[]> {
    const folderPath = this.storage.knowledgeBase[folder];
    const documents: KnowledgeDocument[] = [];

    try {
      await this.walkDirectory(folderPath, folder, async (filePath) => {
        const doc = await this.processFile(filePath, folder, discoveredAt);
        if (doc) documents.push(doc);
      });
    } catch (error) {
      this.logger.warn(
        `Could not scan folder "${folder}" at ${folderPath}: ${error instanceof Error ? error.message : error}`,
      );
    }

    return documents;
  }

  private async walkDirectory(
    dirPath: string,
    folder: KnowledgeBaseFolder,
    onFile: (filePath: string) => Promise<void>,
  ): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, folder, onFile);
      } else if (entry.isFile()) {
        const extension = getFileExtension(entry.name);
        if (isSupportedExtension(extension)) {
          await onFile(fullPath);
        }
      }
    }
  }

  private async processFile(
    filePath: string,
    folder: KnowledgeBaseFolder,
    discoveredAt: Date,
  ): Promise<KnowledgeDocument | null> {
    try {
      const fileStat = await stat(filePath);
      const buffer = await readFile(filePath);
      const checksum = computeChecksum(buffer);
      const relativePath = relative(this.storage.knowledgeBase.root, filePath);

      return buildDocumentMetadata({
        filePath,
        relativePath,
        folder,
        size: fileStat.size,
        createdAt: fileStat.birthtime,
        modifiedAt: fileStat.mtime,
        checksum,
        discoveredAt,
      });
    } catch (error) {
      this.logger.debug(
        `Skipped file ${filePath}: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }
}
