import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { configuration } from '@config/configuration';
import { DocumentProcessingModule } from '@modules/document-processing';
import { MockOcrProvider } from '@modules/document-processing';
import { EwiDocumentsModule } from './ewi-documents.module';
import { EwiDocumentIntakeService } from './ewi-document-intake.service';
import { EwiReportReferenceService } from './ewi-report-reference.service';

describe('EwiDocumentIntakeService', () => {
  let intake: EwiDocumentIntakeService;
  let reportRefs: EwiReportReferenceService;
  let mockOcr: MockOcrProvider;
  let tempDir: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [configuration] }),
        DocumentProcessingModule,
        EwiDocumentsModule,
      ],
    }).compile();

    intake = module.get(EwiDocumentIntakeService);
    reportRefs = module.get(EwiReportReferenceService);
    mockOcr = module.get(MockOcrProvider);
    mockOcr.clearFixtures();
    intake.clear();
    tempDir = mkdtempSync(join(tmpdir(), 'ewi-doc-test-'));
  });

  it('builds evidence refs with page and Bates when present', async () => {
    const path = join(tempDir, 'deposition.pdf');
    writeFileSync(path, minimalPdfWithBlankPage());
    mockOcr.setPageText(1, 'Transcript page. Bates SMITH000321.');

    const doc = await intake.ingest({
      filePath: path,
      investigationId: 'inv-1',
      documentId: 'dep-1',
      kindHint: 'deposition_transcript',
      access: 'public',
    });

    expect(doc.ocrStatus).toBe('completed');
    expect(doc.batesNumbers).toContain('SMITH000321');
    expect(doc.evidenceReferences.some((ref) => ref.pageNumber === 1)).toBe(
      true,
    );
    expect(
      doc.evidenceReferences.some((ref) => ref.batesNumber === 'SMITH000321'),
    ).toBe(true);
    expect(doc.evidenceReferences.every((ref) => ref.pageNumber !== 99)).toBe(
      true,
    );
  });

  it('detects duplicate documents by checksum', async () => {
    const path = join(tempDir, 'cv.txt');
    writeFileSync(path, 'Curriculum Vitae of Jane Doe.\nEducation listed.');

    const first = await intake.ingest({
      filePath: path,
      documentId: 'cv-1',
      kindHint: 'cv',
    });
    const second = await intake.ingest({
      filePath: path,
      documentId: 'cv-2',
      kindHint: 'cv',
    });

    expect(first.duplicateOfDocumentId).toBeNull();
    expect(second.duplicateOfDocumentId).toBe(first.documentId);
    expect(second.warnings.join(' ')).toMatch(/Duplicate/i);
  });

  it('rejects Lexis documents without storing body text', async () => {
    const path = join(tempDir, 'lexis.pdf');
    writeFileSync(path, minimalPdfWithBlankPage());

    const doc = await intake.ingest({
      filePath: path,
      sourceProvider: 'lexisnexis',
      sourceUrl: 'https://advance.lexis.com/example',
      access: 'restricted',
    });

    expect(doc.storageStatus).toBe('rejected');
    expect(doc.normalizedText).toBe('');
    expect(doc.warnings.join(' ')).toMatch(/not be stored/i);
  });

  it('builds a searchable report TOC reference index', async () => {
    const path = join(tempDir, 'order.pdf');
    writeFileSync(path, minimalPdfWithBlankPage());
    mockOcr.setPageText(1, 'Limiting order Bates COURT000111.');

    const doc = await intake.ingest({
      filePath: path,
      investigationId: 'inv-9',
      documentId: 'order-1',
      kindHint: 'court_document',
    });

    const index = reportRefs.buildIndex({ investigationId: 'inv-9' });
    expect(index.entries.length).toBe(41);
    expect(index.batesIndex.COURT000111?.length).toBeGreaterThan(0);
    expect(reportRefs.findByBates('COURT000111', 'inv-9')[0]?.documentId).toBe(
      doc.documentId,
    );
    expect(reportRefs.findByPage('order-1', 1, 'inv-9').length).toBeGreaterThan(
      0,
    );
    expect(reportRefs.findByPage('order-1', 99, 'inv-9')).toEqual([]);
  });
});

function minimalPdfWithBlankPage(): Buffer {
  const stream = '';
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
