import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { configuration } from '@config/configuration';
import { DocumentProcessingModule } from '../document-processing.module';
import { DocumentProcessingService } from './document-processing.service';
import { MockOcrProvider } from '../ocr/mock-ocr.provider';
import { DocumentProcessingException } from '../exceptions';
import { PdfParser } from '../parsers/pdf.parser';

describe('DocumentProcessingService OCR and page refs', () => {
  let service: DocumentProcessingService;
  let mockOcr: MockOcrProvider;
  let tempDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [configuration] }),
        DocumentProcessingModule,
      ],
    }).compile();

    service = module.get(DocumentProcessingService);
    mockOcr = module.get(MockOcrProvider);
    mockOcr.clearFixtures();
    tempDir = mkdtempSync(join(tmpdir(), 'mca-ocr-test-'));
  });

  it('marks scanned low-text PDFs as needing OCR and preserves page numbers', async () => {
    // Minimal valid PDF with almost no text (pdfjs can open empty content streams).
    const scannedPath = join(tempDir, 'scanned.pdf');
    writeFileSync(scannedPath, minimalPdfWithBlankPage());

    mockOcr.setPageText(
      1,
      'Deposition excerpt Bates ACME000777 on scanned page.',
    );

    const result = await service.processDocument(
      { filePath: scannedPath, documentId: 'scan-1' },
      { skipValidation: true },
    );

    expect(result.metadata.needsOcr).toBe(true);
    expect(result.ocrAttempted).toBe(true);
    expect(result.metadata.ocrStatus).toBe('completed');
    expect(result.pageReferences.map((page) => page.pageNumber)).toEqual([1]);
    expect(result.batesNumbers).toContain('ACME000777');
    expect(result.normalizedText).toMatch(/ACME000777/);
  });

  it('marks OCR failure without inventing text', async () => {
    const scannedPath = join(tempDir, 'scanned-fail.pdf');
    writeFileSync(scannedPath, minimalPdfWithBlankPage());
    mockOcr.setFailNext(true);

    const result = await service.processDocument(
      { filePath: scannedPath },
      { skipValidation: true },
    );

    expect(result.metadata.ocrStatus).toBe('failed');
    expect(result.warnings.join(' ')).toMatch(
      /OCR failed|intentionally failed/i,
    );
    expect(result.batesNumbers).toEqual([]);
  });

  it('does not invent page numbers for plain text documents', async () => {
    const txtPath = join(tempDir, 'notes.txt');
    writeFileSync(
      txtPath,
      'Expert notes without pagination.\nBates ACME000001 appears.',
    );

    const result = await service.processDocument(
      { filePath: txtPath },
      { skipValidation: true, skipOcr: true },
    );

    expect(result.pageReferences).toEqual([]);
    expect(result.batesNumbers).toContain('ACME000001');
  });

  it('rejects Lexis PDF body persistence', async () => {
    const pdfPath = join(tempDir, 'lexis.pdf');
    writeFileSync(
      pdfPath,
      minimalPdfWithText('Licensed Lexis body ACME000999'),
    );

    const result = await service.processDocument(
      {
        filePath: pdfPath,
        sourceProvider: 'lexisnexis',
        sourceUrl: 'https://advance.lexis.com/example',
        access: 'restricted',
      },
      { skipValidation: true, skipOcr: true },
    );

    expect(result.normalizedText).toBe('');
    expect(result.filePath).toBe('');
    expect(result.warnings.join(' ')).toMatch(/not be stored|Lexis/i);
  });

  it('throws for corrupted PDF files', async () => {
    const badPath = join(tempDir, 'corrupt.pdf');
    writeFileSync(badPath, Buffer.from('%PDF-1.4 corrupted-bytes'));

    await expect(
      service.processDocument(
        { filePath: badPath },
        { skipValidation: true, skipOcr: true },
      ),
    ).rejects.toBeInstanceOf(DocumentProcessingException);
  });
});

describe('PdfParser scanned detection', () => {
  it('sets needsOcr for nearly empty PDFs', async () => {
    const parser = new PdfParser();
    const output = await parser.parse({
      filePath: 'scanned.pdf',
      buffer: minimalPdfWithBlankPage(),
      filename: 'scanned.pdf',
      extension: 'pdf',
      fileSize: 100,
      createdAt: new Date(),
      modifiedAt: new Date(),
    });
    expect(output.needsOcr).toBe(true);
    expect(output.pages[0]?.pageNumber).toBe(1);
  });
});

/** Minimal one-page PDF with no extractable text. */
function minimalPdfWithBlankPage(): Buffer {
  return minimalPdfWithText('');
}

function minimalPdfWithText(text: string): Buffer {
  // Very small PDF. When text is empty, pdfjs still returns a page with ''.
  const safe = text.replace(/[()\\]/g, '');
  const stream = safe ? `BT /F1 12 Tf 100 700 Td (${safe}) Tj ET` : '';
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj',
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${object}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
