import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import type { StorageSettings } from '@config/config.types';
import { KnowledgeBaseService } from '@modules/knowledge-base/services/knowledge-base.service';
import { getFileExtension } from '@modules/knowledge-base/utils';
import { validateDocument } from '@modules/knowledge-base/utils';
import type { KnowledgeDocument } from '@modules/knowledge-base/types';
import { ParserFactory } from '../parsers/parser.factory';
import type {
  ProcessDocumentInput,
  ProcessDocumentOptions,
  ProcessedDocumentResult,
} from '../types';
import type { IDocumentProcessingService } from '../interfaces';
import {
  DocumentTooLargeException,
  EmptyDocumentException,
  ParsingFailedException,
} from '../exceptions';
import {
  buildExtractedMetadata,
  joinPageTexts,
  normalizeText,
  readFileMetadata,
} from '../utils';

/**
 * Document processing pipeline entry point.
 *
 * Workflow: Discover → Validate → Choose Parser → Extract Metadata →
 *           Extract Text → Normalize → Return Structured Result
 */
@Injectable()
export class DocumentProcessingService implements IDocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly parserFactory: ParserFactory,
    private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {}

  private get storage(): StorageSettings {
    return this.configService.get<StorageSettings>('storage')!;
  }

  async processKnowledgeBaseDocument(
    documentId: string,
  ): Promise<ProcessedDocumentResult> {
    const document = await this.knowledgeBaseService.getDocument(documentId);
    if (!document) {
      throw new ParsingFailedException(
        documentId,
        'Document not found in knowledge base',
      );
    }

    return this.processDocument({
      filePath: document.filePath,
      documentId: document.id,
      relativePath: document.relativePath,
    });
  }

  async processDocument(
    input: ProcessDocumentInput,
    options: ProcessDocumentOptions = {},
  ): Promise<ProcessedDocumentResult> {
    const startTime = Date.now();
    const fileMeta = await readFileMetadata(input.filePath);
    const extension = getFileExtension(fileMeta.filename);

    if (fileMeta.fileSize > this.storage.knowledgeBaseMaxFileSizeBytes) {
      throw new DocumentTooLargeException(
        fileMeta.filename,
        fileMeta.fileSize,
        this.storage.knowledgeBaseMaxFileSizeBytes,
      );
    }

    if (!options.skipValidation) {
      const kbDoc: KnowledgeDocument = {
        id: input.documentId ?? 'unknown',
        title: fileMeta.filename,
        filename: fileMeta.filename,
        filePath: input.filePath,
        relativePath: input.relativePath ?? fileMeta.filename,
        extension,
        category: 'other',
        subCategory: null,
        folder: 'uploads',
        size: fileMeta.fileSize,
        createdAt: fileMeta.createdAt,
        modifiedAt: fileMeta.modifiedAt,
        checksum: '',
        status: 'pending',
        discoveredAt: new Date(),
      };

      const validation = validateDocument(kbDoc, this.storage);
      if (!validation.valid) {
        const messages = validation.errors.map((e) => e.message).join('; ');
        throw new ParsingFailedException(fileMeta.filename, messages);
      }
    }

    const buffer = await readFile(input.filePath);
    const parser = this.parserFactory.getParser(extension);

    this.logger.debug(
      `Processing "${fileMeta.filename}" with ${parser.parserType} parser`,
    );

    const parserOutput = await parser.parse({
      filePath: input.filePath,
      buffer,
      filename: fileMeta.filename,
      extension,
      fileSize: fileMeta.fileSize,
      createdAt: fileMeta.createdAt,
      modifiedAt: fileMeta.modifiedAt,
    });

    const rawText =
      parserOutput.pages.length > 0
        ? joinPageTexts(parserOutput.pages)
        : parserOutput.rawText ||
          parserOutput.sections.map((s) => s.content).join('\n\n');

    const normalizedText = normalizeText(rawText);

    if (!normalizedText.trim()) {
      throw new EmptyDocumentException(fileMeta.filename);
    }

    const metadata = buildExtractedMetadata({
      filename: fileMeta.filename,
      extension,
      fileSize: fileMeta.fileSize,
      createdAt: fileMeta.createdAt,
      modifiedAt: fileMeta.modifiedAt,
      parserOutput,
      normalizedText,
    });

    const result: ProcessedDocumentResult = {
      documentId: input.documentId ?? '',
      filePath: input.filePath,
      relativePath: input.relativePath ?? fileMeta.filename,
      parserType: parser.parserType,
      metadata,
      pages: parserOutput.pages,
      sections: parserOutput.sections,
      rawText,
      normalizedText,
      processedAt: new Date(),
      processingDurationMs: Date.now() - startTime,
      warnings: parserOutput.warnings,
    };

    this.logger.log(
      `Processed "${fileMeta.filename}": ${metadata.pageCount} pages, ${metadata.wordCount} words, ${metadata.estimatedTokens} est. tokens (${result.processingDurationMs}ms)`,
    );

    return result;
  }
}
