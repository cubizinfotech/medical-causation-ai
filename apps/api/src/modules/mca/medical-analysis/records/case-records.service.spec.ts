import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { CaseRecordsService } from './case-records.service';
import { makeTestPdf } from './testing/make-test-pdf';

interface StoredRecord {
  id: string;
  ownerUserId: string;
  caseId: string | null;
  originalName: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
  pageCount: number;
  unreadablePages: number[];
  createdAt: Date;
  pages?: Array<{ pageNumber: number; text: string; batesNumbers: string[] }>;
}

/** Just enough of Prisma's caseRecord API for these tests. */
function fakePrisma() {
  const rows: StoredRecord[] = [];
  const matches = (row: StoredRecord, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && 'in' in value) {
        return (value as { in: string[] }).in.includes(
          row[key as keyof StoredRecord] as string,
        );
      }
      return row[key as keyof StoredRecord] === value;
    });
  const caseRecord = {
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
        data: StoredRecord & {
          pages: { create: StoredRecord['pages'] };
        };
      }) => {
        const row: StoredRecord = {
          ...data,
          caseId: null,
          createdAt: new Date(),
          pages: data.pages.create,
        };
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
        data: Partial<StoredRecord>;
      }) => {
        rows
          .filter((row) => matches(row, where))
          .forEach((row) => Object.assign(row, data));
        return Promise.resolve();
      },
    ),
  };
  return { rows, prisma: { caseRecord } };
}

const ER_PAGE = [
  'EMERGENCY DEPARTMENT NOTE 08/14/2024',
  'Brief loss of consciousness after rear-end collision.',
  'Diagnosis: Concussion with loss of consciousness S06.0X1A',
];

describe('CaseRecordsService', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'case-records-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function build(overrides: Partial<Record<string, number>> = {}) {
    const fake = fakePrisma();
    const config = {
      get: () => ({
        storagePath: root,
        maxFileSizeBytes: 5 * 1024 * 1024,
        maxFilesPerCase: 2,
        maxPagesPerCase: 5,
        chronologyBatchChars: 12000,
        chronologyPromptChars: 10000,
        stagedTtlHours: 24,
        ...overrides,
      }),
    };
    const service = new CaseRecordsService(
      fake.prisma as never,
      config as never,
    );
    return { ...fake, service };
  }

  function file(buffer: Buffer, name = 'er-records.pdf') {
    return {
      originalname: name,
      mimetype: 'application/pdf',
      size: buffer.length,
      buffer,
    };
  }

  it('stores a readable PDF with its page text and flags scanned pages', async () => {
    const { service, rows } = build();
    const pdf = makeTestPdf([ER_PAGE, [], ['Follow-up visit with neurology.']]);

    const summary = await service.upload('user-1', file(pdf));

    expect(summary).toMatchObject({
      name: 'er-records.pdf',
      pageCount: 3,
      readablePages: 2,
      unreadablePages: [2],
    });
    const row = rows[0];
    expect(row.ownerUserId).toBe('user-1');
    expect(row.storageKey).toBe(`user-1/${summary.id}.pdf`);
    expect(row.pages?.[0].text).toContain('rear-end collision');
    // Stored under the record id, never the uploaded name.
    expect(readFileSync(join(root, row.storageKey)).equals(pdf)).toBe(true);
  });

  it('rejects files that are not PDFs, even with a .pdf name', async () => {
    const { service } = build();
    await expect(
      service.upload('user-1', file(Buffer.from('MZ fake executable'))),
    ).rejects.toThrow('Only PDF medical records can be uploaded.');
  });

  it('rejects a fully scanned PDF with a clear message', async () => {
    const { service, rows } = build();
    await expect(
      service.upload('user-1', file(makeTestPdf([[], []]))),
    ).rejects.toThrow(/scanned/);
    expect(rows).toHaveLength(0);
  });

  it('rejects files over the page limit', async () => {
    const { service } = build({ maxPagesPerCase: 1 });
    await expect(
      service.upload('user-1', file(makeTestPdf([ER_PAGE, ER_PAGE]))),
    ).rejects.toThrow(
      'This PDF has 2 pages. The limit is 1 pages per analysis.',
    );
  });

  it('returns the existing record when the same file is uploaded twice', async () => {
    const { service, rows } = build();
    const pdf = makeTestPdf([ER_PAGE]);
    const first = await service.upload('user-1', file(pdf));
    const second = await service.upload('user-1', file(pdf, 'copy.pdf'));
    expect(second.id).toBe(first.id);
    expect(rows).toHaveLength(1);
  });

  it("will not let another user read or delete someone's record", async () => {
    const { service } = build();
    const { id } = await service.upload('user-1', file(makeTestPdf([ER_PAGE])));
    await expect(service.readFile('user-2', id)).rejects.toThrow(
      'Record not found',
    );
    await expect(service.deleteStaged('user-2', id)).rejects.toThrow(
      'Record not found',
    );
  });

  it('checks ownership, attachment and the page budget before an analysis', async () => {
    const { service, rows } = build({ maxPagesPerCase: 5 });
    const a = await service.upload(
      'user-1',
      file(makeTestPdf([ER_PAGE, ER_PAGE])),
    );
    const b = await service.upload(
      'user-1',
      file(makeTestPdf([ER_PAGE, ER_PAGE, ER_PAGE, ER_PAGE]), 'b.pdf'),
    );

    await expect(service.assertAttachable('user-2', [a.id])).rejects.toThrow(
      /not found/,
    );
    await expect(
      service.assertAttachable('user-1', [a.id, b.id]),
    ).rejects.toThrow(
      'These records have 6 pages in total. The limit is 5 pages per analysis.',
    );

    await service.assertAttachable('user-1', [a.id]);
    await service.attachToCase('user-1', [a.id], 'case-1');
    expect(rows.find((row) => row.id === a.id)?.caseId).toBe('case-1');

    await expect(
      service.assertAttachable('user-1', [a.id]),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.deleteStaged('user-1', a.id)).rejects.toThrow(
      /belongs to an analysis/,
    );
  });

  it('deletes the file when a staged record is removed', async () => {
    const { service, rows } = build();
    const { id } = await service.upload('user-1', file(makeTestPdf([ER_PAGE])));
    const path = join(root, rows[0].storageKey);
    expect(existsSync(path)).toBe(true);

    await service.deleteStaged('user-1', id);
    expect(existsSync(path)).toBe(false);
    expect(rows).toHaveLength(0);
  });
});
