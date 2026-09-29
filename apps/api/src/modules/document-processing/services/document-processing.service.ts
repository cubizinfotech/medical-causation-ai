import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import type { StorageSettings } from '@config/config.types';
import type { OcrSettings } from '@config/ocr.config';
import { KnowledgeBaseService } from '@modules/knowledge-base/services/knowledge-base.service';
import { getFileExtension } from '@modules/knowledge-base/utils';
import { validateDocument } from '@modules/knowledge-base/utils';
import type { KnowledgeDocument } from '@modules/knowledge-base/types';
import { ParserFactory } from '../parsers/parser.factory';
import { OcrService } from '../ocr/ocr.service';
import type {
  OcrStatus,
  PageReference,
  ProcessDocumentInput,
  ProcessDocumentOptions,
  ProcessedDocumentResult,
  ProcessedPage,
} from '../types';
import type { IDocumentProcessingService } from '../interfaces';
import {
  DocumentTooLargeException,
  EmptyDocumentException,
  ParsingFailedException,
} from '../exceptions';
import {
  attachBatesToPages,
  buildExtractedMetadata,
  detectBatesNumbers,
  evaluateDocumentStorage,
  joinPageTexts,
  normalizeText,
  readFileMetadata,
} from '../utils';

/**
 * Document processing pipeline entry point.
 *
 * Workflow: Discover → Validate → Storage policy → Choose Parser →
 *           Extract Metadata → Extract Text → OCR (when required) →
 *           Bates/page refs → Normalize → Return Structured Result
 */
@Injectable()
export class DocumentProcessingService implements IDocumentProcessingService {
  private readonly logger = new Logger(DocumentProcessingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly parserFactory: ParserFactory,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly ocrService: OcrService,
  ) {}

  private get storage(): StorageSettings {
    return this.configService.get<StorageSettings>('storage')!;
  }

  private get ocrSettings(): OcrSettings {
    return (
      this.configService.get<OcrSettings>('ocr') ?? {
        provider: 'mock',
        autoOcr: true,
      }
    );
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

    const storagePolicy = evaluateDocumentStorage({
      filename: fileMeta.filename,
      extension,
      sourceProvider: input.sourceProvider,
      sourceUrl: input.sourceUrl,
      access: input.access,
    });

    if (storagePolicy.decision === 'rejected') {
      this.logger.warn(
        `Storage rejected for "${fileMeta.filename}": ${storagePolicy.reason}`,
      );
    }

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
    const checksum = createHash('sha256').update(buffer).digest('hex');
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

    let pages: ProcessedPage[] = parserOutput.pages;
    let ocrAttempted = false;
    let ocrStatus: OcrStatus = parserOutput.needsOcr
      ? 'required'
      : 'not_required';
    const warnings = [...parserOutput.warnings];

    const shouldOcr =
      !options.skipOcr &&
      this.ocrSettings.autoOcr &&
      (options.forceOcr || Boolean(parserOutput.needsOcr));

    if (shouldOcr) {
      ocrAttempted = true;
      const { pages: ocrPages, ocr } =
        await this.ocrService.recognizeDocumentPages(
          pages.length
            ? pages
            : [
                {
                  pageNumber: 1,
                  text: parserOutput.rawText,
                  wordCount: 0,
                  charCount: parserOutput.rawText.length,
                },
              ],
        );
      pages = ocrPages;
      ocrStatus = ocr.status;
      warnings.push(...ocr.warnings);
      if (ocr.status === 'failed') {
        warnings.push(
          'OCR failed. Document is marked accordingly; no text was invented.',
        );
      }
    }

    pages = attachBatesToPages(pages);

    const rawText =
      pages.length > 0
        ? joinPageTexts(pages)
        : parserOutput.rawText ||
          parserOutput.sections.map((s) => s.content).join('\n\n');

    const normalizedText = normalizeText(rawText);
    const batesNumbers = detectBatesNumbers(normalizedText);
    const pageReferences: PageReference[] = pages.map((page) => ({
      pageNumber: page.pageNumber,
      charCount: page.charCount,
      batesNumbers: page.batesNumbers ?? [],
    }));

    if (!normalizedText.trim()) {
      if (parserOutput.needsOcr || ocrAttempted) {
        warnings.push(
          'No extractable text after parsing/OCR. Document retained with OCR status only.',
        );
      } else {
        throw new EmptyDocumentException(fileMeta.filename);
      }
    }

    const metadata = buildExtractedMetadata({
      filename: fileMeta.filename,
      extension,
      fileSize: fileMeta.fileSize,
      createdAt: fileMeta.createdAt,
      modifiedAt: fileMeta.modifiedAt,
      parserOutput: {
        ...parserOutput,
        needsOcr: parserOutput.needsOcr ?? false,
        pageCount: pages.length || parserOutput.pageCount,
      },
      normalizedText,
      ocrStatus,
      checksum,
    });

    const textAllowed = storagePolicy.mayPersistExtractedText;
    const result: ProcessedDocumentResult = {
      documentId: input.documentId ?? '',
      filePath: storagePolicy.mayPersistFile ? input.filePath : '',
      relativePath: input.relativePath ?? fileMeta.filename,
      parserType: parser.parserType,
      metadata,
      pages: textAllowed
        ? pages
        : pages.map((page) => ({
            ...page,
            text: '',
            wordCount: 0,
            charCount: 0,
          })),
      sections: textAllowed ? parserOutput.sections : [],
      rawText: textAllowed ? rawText : '',
      normalizedText: textAllowed ? normalizedText : '',
      processedAt: new Date(),
      processingDurationMs: Date.now() - startTime,
      warnings: [
        ...warnings,
        ...(storagePolicy.decision !== 'store_allowed'
          ? [storagePolicy.reason]
          : []),
      ],
      batesNumbers,
      pageReferences,
      ocrAttempted,
    };

    this.logger.log(
      `Processed "${fileMeta.filename}": ${metadata.pageCount} pages, OCR=${ocrStatus}, Bates=${batesNumbers.length}, storage=${storagePolicy.decision} (${result.processingDurationMs}ms)`,
    );

    return result;
  }
}
