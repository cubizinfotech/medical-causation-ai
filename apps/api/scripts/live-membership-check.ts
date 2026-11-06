/**
 * Live official membership-directory fetch + per-claim assessment for CV
 * membership entries. Does not run a full investigation or write to the DB.
 *
 *   npm run research:memberships
 */
import { SafeFetcher } from '../src/integrations/web-research/safe-fetcher';
import {
  assessMemberships,
  membershipEntriesFromClaims,
  ORGANIZATION_REGISTRY,
  preferredDirectoryUrl,
  resolveOrganization,
} from '../src/modules/ewi/research/memberships';
import type { CvClaim } from '../src/modules/ewi/cv/cv.types';
import { loadEnv } from './user-accounts';

/** Graham-class multi-membership seed (generic fixture — not hardcoded outcomes). */
const FIXTURE_CLAIMS: CvClaim[] = [
  {
    id: 'mem-aacn',
    category: 'membership',
    statement: 'Member, American Academy of Clinical Neuropsychology',
    details: { name: 'American Academy of Clinical Neuropsychology' },
    page: 1,
    quote: 'Member, American Academy of Clinical Neuropsychology',
  },
  {
    id: 'mem-nan',
    category: 'membership',
    statement: 'Member, National Academy of Neuropsychology',
    details: { name: 'National Academy of Neuropsychology' },
    page: 1,
    quote: 'Member, National Academy of Neuropsychology',
  },
  {
    id: 'mem-apa',
    category: 'membership',
    statement: 'Member, American Psychological Association',
    details: { name: 'American Psychological Association' },
    page: 1,
    quote: 'Member, American Psychological Association',
  },
];

async function main() {
  loadEnv();
  const fetcher = new SafeFetcher({ timeoutMs: 20_000 });
  const entries = membershipEntriesFromClaims(FIXTURE_CLAIMS, {
    cvSourceUrl: 'fixture://graham-class-cv',
  });
  console.log(`Membership entries: ${entries.length}`);
  for (const entry of entries) {
    const org = resolveOrganization(entry.organization);
    console.log(
      ` - ${entry.membershipType} @ ${entry.organization} → registry=${org?.id ?? 'none'} access=${org?.access ?? 'n/a'}`,
    );
  }

  console.log('\nOfficial host reachability:');
  for (const org of ORGANIZATION_REGISTRY.filter((o) => !o.certificationPrimary)) {
    const url = preferredDirectoryUrl(org) ?? `https://www.${org.hosts[0]}/`;
    try {
      const page = await fetcher.fetchPage(url);
      console.log(
        `  ${org.id}: ${url} → status=${page.status} bytes=${(page.text ?? '').length} note=${page.note ?? ''}`,
      );
    } catch (error) {
      console.log(
        `  ${org.id}: ${url} → error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const dossier = await assessMemberships({
    entries,
    expertName: 'Sample Expert',
    specialty: 'Clinical Neuropsychology',
    city: 'Tampa, FL',
    search: async (query) => {
      const lower = query.toLowerCase();
      const hits: Array<{ url: string; title: string; snippet: string }> = [];
      for (const org of ORGANIZATION_REGISTRY) {
        if (org.hosts.some((h) => lower.includes(h))) {
          const url = preferredDirectoryUrl(org);
          if (url) {
            hits.push({
              url,
              title: org.canonicalName,
              snippet: `${org.canonicalName} member directory`,
            });
          }
        }
      }
      return hits;
    },
    fetchPage: async (url) => {
      try {
        const page = await fetcher.fetchPage(url);
        if (page.status === 'restricted') {
          return {
            url,
            title: page.title ?? null,
            text: page.text ?? page.note ?? '',
            retrievedAt: new Date().toISOString(),
            restricted: true,
            loginRequired: /login|sign in|captcha/i.test(page.note ?? ''),
          };
        }
        if (page.status !== 'read' || !page.text) return null;
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

  console.log(`\nAssessments: ${dossier.assessments.length}`);
  for (const a of dossier.assessments) {
    console.log(
      ` - ${a.organizationCanonical}: status=${a.status} evidence=${a.evidence?.url ?? 'none'}`,
    );
    console.log(`   ${a.explanation}`);
    for (const lim of a.limitations) console.log(`   limitation: ${lim}`);
  }
  console.log(
    '\nNote: Full Graham Word/PDF regen through the investigation job runner was not run in this script; requires deployed APIs/job runner.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
