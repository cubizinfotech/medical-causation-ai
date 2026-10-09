import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  makeScannedTestPdf,
  makeTestPdf,
} from '@modules/mca/medical-analysis/records/testing/make-test-pdf';
import { ExpertDocumentsService } from './expert-documents.service';

interface Row {
  id: string;
  ownerUserId: string;
  investigationId: string | null;
  kind: string;
  originalName: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
  pageCount: number;
  unreadablePages: number[];
  ocrPages: number[];
  ocrCompletedAt: Date | null;
  createdAt: Date;
  pages: Array<{
    pageNumber: number;
    text: string;
    ocrConfidence: number | null;
  }>;
}

function fakePrisma() {
  const rows: Row[] = [];
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(
      ([key, value]) => row[key as keyof Row] === value,
    );
  const expertDocument = {
    findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(rows.find((row) => matches(row, where)) ?? null),
    ),
    findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(rows.filter((row) => matches(row, where))),
    ),
    count: jest.fn(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(rows.filter((row) => matches(row, where)).length),
    ),
    create: jest.fn(
      ({
        data,
      }: {
        data: Partial<Omit<Row, 'pages'>> & {
          pages: { create: Array<Partial<Row['pages'][number]>> };
        };
      }) => {
        const row = {
          investigationId: null,
          ocrPages: [],
          ocrCompletedAt: null,
          ...data,
          createdAt: new Date(),
          pages: data.pages.create.map((page) => ({
            ocrConfidence: null,
            ...page,
          })),
        } as Row;
        rows.push(row);
        return Promise.resolve(row);
      },
    ),
    delete: jest.fn(({ where }: { where: { id: string } }) => {
      rows.splice(
        rows.findIndex((row) => row.id === where.id),
        1,
      );
      return Promise.resolve();
    }),
    updateMany: jest.fn(
      ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Partial<Row>;
      }) => {
        const matched = rows.filter((row) => matches(row, where));
        matched.forEach((row) => Object.assign(row, data));
        return Promise.resolve({ count: matched.length });
      },
    ),
    update: jest.fn(
      ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((candidate) => candidate.id === where.id);
        if (row) Object.assign(row, data);
        return Promise.resolve(row);
      },
    ),
  };
  const expertDocumentPage = {
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: {
          documentId_pageNumber: { documentId: string; pageNumber: number };
        };
        data: Partial<Row['pages'][number]>;
      }) => {
        const { documentId, pageNumber } = where.documentId_pageNumber;
        const page = rows
          .find((row) => row.id === documentId)
          ?.pages.find((candidate) => candidate.pageNumber === pageNumber);
        if (page) Object.assign(page, data);
        return Promise.resolve(page);
      },
    ),
  };
  const $transaction = jest.fn((operations: Array<Promise<unknown>>) =>
    Promise.all(operations),
  );
  return { rows, prisma: { expertDocument, expertDocumentPage, $transaction } };
}

const CV_PAGE = [
  'JANE A. SMITH, MD - CURRICULUM VITAE',
  'Board Certified, American Board of Psychiatry and Neurology, 2006.',
  'Medical licenses: Arizona 54321.',
];

describe('ExpertDocumentsService', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ewi-docs-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function build(ocrEnabled: boolean, ocrText: Record<number, string> = {}) {
    const fake = fakePrisma();
    const ocr = {
      recognize: jest.fn((_pdf: Buffer, pages: number[]) =>
        Promise.resolve(
          pages.map((pageNumber) => ({
            pageNumber,
            text: ocrText[pageNumber] ?? '',
            confidence: ocrText[pageNumber] ? 90 : 0,
          })),
        ),
      ),
    };
    const config = {
      get: () => ({
        storagePath: root,
        maxFileSizeBytes: 5 * 1024 * 1024,
        maxPages: 10,
        stagedTtlHours: 24,
        ocrEnabled,
        ocrDpi: 200,
        batchChars: 12000,
      }),
    };
    const service = new ExpertDocumentsService(
      fake.prisma as never,
      config as never,
      ocr as never,
    );
    return { ...fake, service, ocr };
  }

  function file(buffer: Buffer, name = 'smith-cv.pdf') {
    return {
      originalname: name,
      mimetype: 'application/pdf',
      size: buffer.length,
      buffer,
    };
  }

  it('stores a CV under its id and lets only its owner read or delete it', async () => {
    const { service, rows } = build(false);
    const summary = await service.upload(
      'user-1',
      file(makeTestPdf([CV_PAGE])),
    );
    expect(summary).toMatchObject({
      kind: 'cv',
      name: 'smith-cv.pdf',
      pageCount: 1,
      readablePages: 1,
      ocrPendingPages: [],
    });
    expect(rows[0].storageKey).toBe(`user-1/${summary.id}.pdf`);
    expect(existsSync(join(root, rows[0].storageKey))).toBe(true);

    await expect(service.readFile('user-2', summary.id)).rejects.toThrow(
      'Document not found',
    );
    await expect(service.assertOwned('user-2', summary.id)).rejects.toThrow(
      /not found/,
    );

    await service.assertOwned('user-1', summary.id);
    expect(
      await service.attachToInvestigation('user-1', summary.id, 'inv-1'),
    ).toBe(summary.id);
    expect(rows[0].investigationId).toBe('inv-1');
    await expect(service.deleteStaged('user-1', summary.id)).rejects.toThrow(
      /belongs to an investigation/,
    );

    await service.deleteFilesForInvestigation('inv-1');
    expect(existsSync(join(root, rows[0].storageKey))).toBe(false);
  });

  it('copies a CV another investigation uses, with its page text', async () => {
    const { service, rows } = build(false);
    const summary = await service.upload(
      'user-1',
      file(makeTestPdf([CV_PAGE])),
    );
    await service.attachToInvestigation('user-1', summary.id, 'inv-1');

    // A retry or re-run of the investigation sends the same CV id.
    const copyId = await service.attachToInvestigation(
      'user-1',
      summary.id,
      'inv-2',
    );
    expect(copyId).not.toBe(summary.id);
    const [original, copy] = rows;
    expect(copy).toMatchObject({
      id: copyId,
      investigationId: 'inv-2',
      originalName: 'smith-cv.pdf',
      sha256: original.sha256,
      storageKey: `user-1/${copyId}.pdf`,
    });
    expect(copy.pages.map((page) => page.text)).toEqual(
      original.pages.map((page) => page.text),
    );

    // Each investigation deletes only its own file.
    await service.deleteFilesForInvestigation('inv-1');
    expect(existsSync(join(root, original.storageKey))).toBe(false);
    expect(existsSync(join(root, copy.storageKey))).toBe(true);

    await expect(
      service.attachToInvestigation('user-2', summary.id, 'inv-3'),
    ).rejects.toThrow(/not found/);
  });

  it('rejects a scanned CV without OCR and reads it once with OCR', async () => {
    const scanned = makeScannedTestPdf([['Curriculum vitae']]);
    await expect(
      build(false).service.upload('user-1', file(scanned)),
    ).rejects.toThrow(/scanned PDF/);

    const text = 'JANE A. SMITH, MD. Board certified in neurology since 2006.';
    const { service, rows, ocr } = build(true, { 1: text });
    const summary = await service.upload('user-1', file(scanned));
    expect(summary.ocrPendingPages).toEqual([1]);

    expect(await service.readScannedPages(summary.id)).toEqual({
      attempted: 1,
      read: 1,
    });
    expect(rows[0]).toMatchObject({ unreadablePages: [], ocrPages: [1] });
    const loaded = await service.loadDocument(summary.id);
    expect(loaded?.pages[0]).toMatchObject({ text, ocrConfidence: 90 });

    await service.readScannedPages(summary.id);
    expect(ocr.recognize).toHaveBeenCalledTimes(1);
  });

  it('rejects files that are not PDFs', async () => {
    await expect(
      build(true).service.upload(
        'user-1',
        file(Buffer.from('hello world'), 'cv.pdf'),
      ),
    ).rejects.toThrow('Only PDF files can be uploaded.');
  });
});
