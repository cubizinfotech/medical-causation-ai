/**
 * Deletes MCA and EWI case history and the files those cases generated.
 *
 * Does not touch the medical library, its chunks, or its embeddings.
 * Does not delete user accounts.
 *
 * From the repository root:
 *   npm run clear:histories
 *   npm run clear:histories -- --yes
 *
 * Without --yes the script only prints the counts. With --yes it deletes.
 */
import { readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { findRepositoryRoot } from '../src/config/case-records.config';
import { loadEnv } from './user-accounts';

async function emptyDirectory(directory: string): Promise<number> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch {
    return 0;
  }
  await Promise.all(
    names.map((name) =>
      rm(join(directory, name), { recursive: true, force: true }),
    ),
  );
  return names.length;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--yes');
  loadEnv();
  const prisma = new PrismaClient();
  const root = findRepositoryRoot();
  const caseRecords = resolve(
    process.env.CASE_RECORDS_PATH?.trim() || join(root, 'data', 'case-records'),
  );
  const ewiDocuments = resolve(
    process.env.EWI_DOCUMENTS_PATH?.trim() ||
      join(root, 'data', 'ewi-documents'),
  );
  const ewiReports = resolve(
    join(root, 'knowledge-base', 'ewi', 'reports', 'investigations'),
  );

  try {
    const [cases, investigations, records, cvs] = await Promise.all([
      prisma.analysisCase.count(),
      prisma.investigation.count(),
      prisma.caseRecord.count(),
      prisma.expertDocument.count(),
    ]);
    console.log(`MCA histories: ${cases}`);
    console.log(`MCA uploaded records: ${records}`);
    console.log(`EWI histories: ${investigations}`);
    console.log(`EWI uploaded CVs: ${cvs}`);
    console.log(`Record files: ${caseRecords}`);
    console.log(`CV files: ${ewiDocuments}`);
    console.log(`Generated EWI reports: ${ewiReports}`);
    if (!apply) {
      console.log(
        '\nNothing was deleted. Run npm run clear:histories -- --yes to delete these histories and generated files.',
      );
      return;
    }

    await prisma.investigation.deleteMany();
    await prisma.analysisCase.deleteMany();
    await prisma.caseRecord.deleteMany();
    await prisma.expertDocument.deleteMany();
    const removed = {
      records: await emptyDirectory(caseRecords),
      documents: await emptyDirectory(ewiDocuments),
      reports: await emptyDirectory(ewiReports),
    };
    console.log(
      `Deleted the histories above and ${removed.records + removed.documents + removed.reports} file(s) or folder(s). The medical library was not changed.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
