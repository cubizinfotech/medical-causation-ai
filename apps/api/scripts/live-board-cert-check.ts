/**
 * Live board-certification claim extraction + issuing-board reachability.
 * Does not invent claims. Without a CV or SERP, assessments stay Not Checked /
 * Self-Reported honestly.
 *
 *   npm run research:board-certs
 *   npx ts-node -r tsconfig-paths/register scripts/live-board-cert-check.ts --name="Nicole Graham"
 */
import { SafeFetcher } from '../src/integrations/web-research/safe-fetcher';
import {
  assessBoardCertifications,
  boardCertificationEntriesFromClaims,
  CERTIFICATION_REGISTRY,
  resolveCertifyingBoard,
} from '../src/modules/ewi/research/board-certifications';
import type { CvClaim } from '../src/modules/ewi/cv/cv.types';
import { loadEnv } from './user-accounts';

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index >= 0) return process.argv[index + 1];
  const prefixed = process.argv.find((a) => a.startsWith(`${flag}=`));
  return prefixed ? prefixed.slice(flag.length + 1) : undefined;
}

/** Fixture claims only for pipeline smoke — not Graham-specific expected outcomes. */
const FIXTURE_CLAIMS: CvClaim[] = [
  {
    id: 'bc-abpp',
    category: 'board_certification',
    statement:
      'Board Certified in Clinical Neuropsychology by the American Board of Professional Psychology (ABPP)',
    details: {
      board: 'American Board of Professional Psychology',
      specialty: 'Clinical Neuropsychology',
    },
    page: 1,
    quote:
      'Board Certified in Clinical Neuropsychology by the American Board of Professional Psychology (ABPP)',
  },
  {
    id: 'mem-aacn',
    category: 'board_certification',
    statement: 'Member, American Academy of Clinical Neuropsychology',
    details: { board: 'AACN' },
    page: 1,
    quote: 'Member, American Academy of Clinical Neuropsychology',
  },
];

async function main() {
  loadEnv();
  const expertName = arg('name') ?? 'Sample Expert';
  const specialty = arg('specialty') ?? 'Clinical Neuropsychology';
  const city = arg('city') ?? 'Tampa, FL';
  const fetcher = new SafeFetcher({ timeoutMs: 20_000 });

  console.log(`Expert: ${expertName} | ${specialty} | ${city}`);
  const entries = boardCertificationEntriesFromClaims(FIXTURE_CLAIMS, {
    cvSourceUrl: 'fixture://board-cert-smoke',
  });
  console.log(`\nExtracted board-cert entries: ${entries.length}`);
  for (const entry of entries) {
    const board = resolveCertifyingBoard(entry.boardName);
    console.log(
      ` - ${entry.credentialName} → board=${entry.boardName} id=${entry.boardId ?? 'unresolved'} registry=${board?.id ?? 'none'}`,
    );
  }

  console.log('\nIssuing-board home reachability:');
  for (const board of CERTIFICATION_REGISTRY) {
    try {
      const page = await fetcher.fetchPage(board.homeUrl);
      console.log(
        `  ${board.id}: ${board.homeUrl} → status=${page.status} bytes=${(page.text ?? '').length} note=${page.note ?? ''}`,
      );
    } catch (error) {
      console.log(
        `  ${board.id}: ${board.homeUrl} → error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // No stub SERP — empty success would falsely become No Matching Record.
  const dossier = await assessBoardCertifications({
    entries,
    expertName,
    specialty,
    city,
  });

  console.log(`\nAssessments: ${dossier.assessments.length}`);
  for (const a of dossier.assessments) {
    console.log(` - ${a.entry.credentialName}: ${a.status}`);
    console.log(`   ${a.explanation}`);
    for (const lim of a.limitations) console.log(`   limitation: ${lim}`);
  }
  console.log(
    '\nLimitations: fixture claims only (not a live Graham CV parse); no SERP wired; Word/PDF regen not run.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
