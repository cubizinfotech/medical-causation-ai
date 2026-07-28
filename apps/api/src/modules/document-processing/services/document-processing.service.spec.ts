import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { existsSync, mkdtempSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { configuration } from '@config/configuration';
import { DocumentProcessingModule } from '../document-processing.module';
import { DocumentProcessingService } from './document-processing.service';
import { ParserFactory } from '../parsers/parser.factory';
import { PARSER_TYPES } from '../constants';

function resolveKnowledgeBaseRoot(): string | null {
  const candidates = [
    resolve(process.cwd(), 'knowledge-base'),
    resolve(process.cwd(), '..', '..', 'knowledge-base'),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

describe('ParserFactory', () => {
  let factory: ParserFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [configuration] }),
        DocumentProcessingModule,
      ],
    }).compile();
    factory = module.get<ParserFactory>(ParserFactory);
  });

  it('should return parser for each supported extension', () => {
    expect(factory.getParser('pdf').parserType).toBe(PARSER_TYPES.PDF);
    expect(factory.getParser('docx').parserType).toBe(PARSER_TYPES.DOCX);
    expect(factory.getParser('txt').parserType).toBe(PARSER_TYPES.TXT);
    expect(factory.getParser('md').parserType).toBe(PARSER_TYPES.MARKDOWN);
  });

  it('should list all supported extensions', () => {
    const extensions = factory.getSupportedExtensions();
    expect(extensions).toContain('pdf');
    expect(extensions).toContain('docx');
    expect(extensions).toContain('txt');
    expect(extensions).toContain('md');
  });
});

describe('DocumentProcessingService', () => {
  let service: DocumentProcessingService;
  let tempDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [configuration] }),
        DocumentProcessingModule,
      ],
    }).compile();

    service = module.get<DocumentProcessingService>(DocumentProcessingService);
    tempDir = mkdtempSync(join(tmpdir(), 'mca-doc-test-'));
  });

  it('should process a TXT file', async () => {
    const txtPath = join(tempDir, 'sample.txt');
    writeFileSync(
      txtPath,
      'Medical Causation Analysis\n\nTrauma may contribute to injury when temporal relationship is established.',
      'utf-8',
    );

    const result = await service.processDocument(
      { filePath: txtPath, documentId: 'test-txt' },
      { skipValidation: true },
    );

    expect(result.parserType).toBe(PARSER_TYPES.TXT);
    expect(result.metadata.wordCount).toBeGreaterThan(5);
    expect(result.normalizedText).toContain('Medical Causation');
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it('should process a Markdown file with headings', async () => {
    const mdPath = join(tempDir, 'sample.md');
    writeFileSync(
      mdPath,
      '# Causation Analysis\n\n## Evidence\n\nBradford Hill criteria apply.',
      'utf-8',
    );

    const result = await service.processDocument(
      { filePath: mdPath },
      { skipValidation: true },
    );

    expect(result.parserType).toBe(PARSER_TYPES.MARKDOWN);
    expect(result.sections.some((s) => s.type === 'heading')).toBe(true);
    expect(result.metadata.estimatedTokens).toBeGreaterThan(0);
  });

  it('should process a PDF with page numbering', async () => {
    const kbRoot = resolveKnowledgeBaseRoot();
    if (!kbRoot) return;

    const pdfPath = join(
      kbRoot,
      'articles',
      'mild tbi',
      '2019 Endocrinology Growth Hormone Guidelines.pdf',
    );

    if (!existsSync(pdfPath)) {
      const fallback = join(kbRoot, 'books', 'ama 6th book.pdf');
      if (!existsSync(fallback)) return;

      const result = await service.processDocument(
        { filePath: fallback },
        { skipValidation: true },
      );

      expect(result.parserType).toBe(PARSER_TYPES.PDF);
      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.metadata.pageCount).toBe(result.pages.length);
      return;
    }

    const result = await service.processDocument(
      { filePath: pdfPath },
      { skipValidation: true },
    );

    expect(result.parserType).toBe(PARSER_TYPES.PDF);
    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.metadata.pageCount).toBe(result.pages.length);
    expect(result.normalizedText.length).toBeGreaterThan(0);
  }, 120000);

  it('should process a DOCX file', async () => {
    const docxPath = join(tempDir, 'sample.docx');
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: 'Medical Report',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              children: [
                new TextRun(
                  'This document describes causation analysis methodology.',
                ),
              ],
            }),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    writeFileSync(docxPath, buffer);

    const result = await service.processDocument(
      { filePath: docxPath },
      { skipValidation: true },
    );

    expect(result.parserType).toBe(PARSER_TYPES.DOCX);
    expect(result.metadata.wordCount).toBeGreaterThan(0);
    expect(result.sections.length).toBeGreaterThan(0);
    expect(result.normalizedText).toContain('causation');
  });
});
