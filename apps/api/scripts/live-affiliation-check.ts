/**
 * Live / fixture institutional affiliation extract + assess smoke.
 * Uses Nicole Graham only as identity input; affiliations come from fixture
 * CV claims (not hardcoded expected outcomes). Without SERP, assessments stay
 * Self-Reported / Not Independently Verified honestly.
 *
 *   npm run research:affiliations
 *   npx ts-node -r tsconfig-paths/register scripts/live-affiliation-check.ts --name="Nicole Graham"
 */
import { SafeFetcher } from '../src/integrations/web-research/safe-fetcher';
import {
  assessInstitutionalAffiliations,
  affiliationEntriesFromClaims,
} from '../src/modules/ewi/research/affiliations';
import type { CvClaim } from '../src/modules/ewi/cv/cv.types';
import { extractStructuredClaimsFromCvText } from '../src/modules/ewi/cv/cv-claims';
import { loadEnv } from './user-accounts';

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index >= 0) return process.argv[index + 1];
  const prefixed = process.argv.find((a) => a.startsWith(`${flag}=`));
  return prefixed ? prefixed.slice(flag.length + 1) : undefined;
}

/** Generic fixture CV body — not Graham-hardcoded expected affiliations. */
const FIXTURE_CV_TEXT = `
Curriculum Vitae

Education
Ph.D., Clinical Psychology, Sample State University, 2010

Training
Clinical Practicum, Sample Medical Center, 2008
Predoctoral Internship, Regional VA Medical Center, 2009
Neuropsychology Fellowship, Sample University Hospital, 2011

Appointments
Clinical Assistant Professor, Sample State University, Department of Psychology, 2018–present
Adjunct Faculty, Coastal College of Health Sciences, 2015–2017

Memberships
Member, American Psychological Association
`;

async function main() {
  loadEnv();
  const expertName = arg('name') ?? 'Nicole Graham';
  const specialty = arg('specialty') ?? 'Clinical Neuropsychology';
  const city = arg('city') ?? 'Tampa, FL';
  const fetcher = new SafeFetcher({ timeoutMs: 20_000 });

  console.log(`Expert (identity only): ${expertName} | ${specialty} | ${city}`);

  const heuristic = extractStructuredClaimsFromCvText(FIXTURE_CV_TEXT);
  const claims: CvClaim[] = heuristic.map((c, i) => ({
    ...c,
    id: `fix-${i + 1}`,
  }));
  console.log(`\nHeuristic CV claims: ${claims.length}`);
  for (const c of claims) {
    console.log(` - [${c.category}] ${c.statement.slice(0, 100)}`);
  }

  const entries = affiliationEntriesFromClaims(claims, {
    cvSourceUrl: 'fixture://affiliation-smoke',
  });
  console.log(`\nAffiliation entries extracted: ${entries.length}`);
  for (const entry of entries) {
    console.log(
      ` - ${entry.class}/${entry.relationshipType}: ${entry.title ?? '(no title)'} @ ${entry.institution ?? '(no institution)'} [${entry.timeframe}]`,
    );
  }

  // Reachability smoke for institutions named in claims only.
  const institutions = [
    ...new Set(
      entries
        .map((e) => e.institution)
        .filter((v): v is string => Boolean(v?.trim())),
    ),
  ];
  console.log('\nNamed-institution home reachability (best-effort):');
  for (const institution of institutions.slice(0, 5)) {
    const guess = `https://www.google.com/search?q=${encodeURIComponent(institution + ' official site')}`;
    console.log(`  ${institution}: not inventing host; SERP would scope to this name only (${guess.slice(0, 80)}…)`);
  }

  // Optional fetch of a neutral page to prove SafeFetcher works (not a verification).
  try {
    const page = await fetcher.fetchPage('https://example.com/');
    console.log(
      `\nSafeFetcher smoke: example.com → status=${page.status} bytes=${(page.text ?? '').length}`,
    );
  } catch (error) {
    console.log(
      `\nSafeFetcher smoke failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // No stub SERP — empty success would falsely become No Matching Record.
  const dossier = await assessInstitutionalAffiliations({
    entries,
    expertName,
    specialty,
    city,
  });

  console.log(`\nAssessments: ${dossier.assessments.length}`);
  for (const a of dossier.assessments) {
    console.log(
      ` - ${a.entry.class} ${a.entry.institution ?? '?'}: ${a.status}`,
    );
    console.log(`   ${a.explanation}`);
    for (const lim of a.limitations) console.log(`   limitation: ${lim}`);
  }
  console.log(
    '\nLimitations: fixture CV claims only (not a live Graham CV parse); no SERP wired; Word/PDF regen not run (unit/fixture-only).',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
