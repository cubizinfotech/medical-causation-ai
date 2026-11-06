/**
 * Live expert-witness / IME advertising directory reachability + assessment.
 * Does not run a full investigation or write to the DB.
 *
 *   npm run research:directories
 *   npm run research:directories -- --name "Nicole Graham" --specialty "Clinical Neuropsychology" --city "Tampa, FL"
 */
import { SafeFetcher } from '../src/integrations/web-research/safe-fetcher';
import {
  assessDirectoryListings,
  DIRECTORY_REGISTRY,
  directoryById,
} from '../src/modules/ewi/research/directories';
import { loadEnv } from './user-accounts';

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index >= 0) return process.argv[index + 1];
  const prefixed = process.argv.find((a) => a.startsWith(`${flag}=`));
  return prefixed ? prefixed.slice(flag.length + 1) : undefined;
}

async function main() {
  loadEnv();
  const expertName = arg('name') ?? 'Nicole Graham';
  const specialty = arg('specialty') ?? 'Clinical Neuropsychology';
  const city = arg('city') ?? 'Tampa, FL';
  const fetcher = new SafeFetcher({ timeoutMs: 20_000 });

  console.log(`Expert: ${expertName} | ${specialty} | ${city}`);
  console.log('\nDirectory home reachability:');
  for (const dir of DIRECTORY_REGISTRY) {
    try {
      const page = await fetcher.fetchPage(dir.homeUrl);
      console.log(
        `  ${dir.id}: ${dir.homeUrl} → status=${page.status} bytes=${(page.text ?? '').length} note=${page.note ?? ''} method=${dir.searchMethod} access=${dir.access}`,
      );
    } catch (error) {
      console.log(
        `  ${dir.id}: ${dir.homeUrl} → error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const focus = ['jurispro', 'seak', 'expertpages']
    .map((id) => directoryById(id)!)
    .filter(Boolean);

  // Do not inject a stub search that returns []. An empty successful SERP would
  // be reported as No Matching Public Profile; without a real SERP provider the
  // honest status is Not Checked (home-page reachability is still printed above).
  const dossier = await assessDirectoryListings({
    expertName,
    specialty,
    city,
    directories: focus,
    fetchPage: async (url) => {
      try {
        const page = await fetcher.fetchPage(url);
        if (
          page.status === 'restricted' ||
          /login|captcha|sign in/i.test(page.note ?? '')
        ) {
          return {
            url,
            title: page.title ?? null,
            text: page.text ?? page.note ?? '',
            retrievedAt: new Date().toISOString(),
            restricted: true,
            loginRequired: /login|sign in/i.test(page.note ?? ''),
          };
        }
        if (page.status !== 'read' || !page.text) {
          return null;
        }
        return {
          url,
          title: page.title ?? null,
          text: page.text,
          retrievedAt: new Date().toISOString(),
        };
      } catch {
        return null;
      }
    },
  });

  console.log(`\nAssessments (no live SERP — Not Checked expected): ${dossier.assessments.length}`);
  for (const a of dossier.assessments) {
    console.log(` - ${a.directoryName}: ${a.status}`);
    console.log(`   ${a.explanation}`);
    if (a.profileUrl) console.log(`   profile: ${a.profileUrl}`);
    for (const lim of a.limitations) console.log(`   limitation: ${lim}`);
  }
  console.log(
    '\nLimitations: site-scoped SERP not wired in this script; full Graham Word/PDF regen was not run (job runner not invoked).',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
