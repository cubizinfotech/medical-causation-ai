/**
 * Live APA CoA / CHEA page fetch + per-degree assessment for CV education
 * entries. Does not run a full investigation or write to the database.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/live-accreditation-check.ts
 */
import { SafeFetcher } from '../src/integrations/web-research/safe-fetcher';
import {
  assessProgramAccreditation,
  educationEntriesFromClaims,
} from '../src/modules/ewi/research/accreditation';
import type { CvClaim } from '../src/modules/ewi/cv/cv.types';
import { loadEnv } from './user-accounts';

/** Graham-class multi-degree seed (generic fixture shape — not hardcoded outcomes). */
const FIXTURE_CLAIMS: CvClaim[] = [
  {
    id: 'edu-ba',
    category: 'education',
    statement:
      'B.A., Forensic Psychology, John Jay College of Criminal Justice, City University of New York, 2005',
    details: {
      institution: 'City University of New York',
      degree: 'B.A.',
      year: '2005',
    },
    page: 1,
    quote:
      'B.A., Forensic Psychology, John Jay College of Criminal Justice, City University of New York, 2005',
  },
  {
    id: 'edu-ma',
    category: 'education',
    statement:
      'M.A., Clinical Psychology, University of South Florida, 2008',
    details: {
      institution: 'University of South Florida',
      degree: 'M.A.',
      year: '2008',
    },
    page: 1,
    quote: 'M.A., Clinical Psychology, University of South Florida, 2008',
  },
  {
    id: 'edu-phd',
    category: 'education',
    statement:
      'Ph.D., Clinical Psychology, University of South Florida, 2012',
    details: {
      institution: 'University of South Florida',
      degree: 'Ph.D.',
      year: '2012',
    },
    page: 1,
    quote: 'Ph.D., Clinical Psychology, University of South Florida, 2012',
  },
];

const CANDIDATE_URLS = [
  'https://accreditation.apa.org/',
  'https://www.apa.org/ed/accreditation',
  'https://www.chea.org/',
  'https://ope.ed.gov/dapip/#/home',
];

async function main() {
  loadEnv();
  const fetcher = new SafeFetcher({ timeoutMs: 20_000 });
  const entries = educationEntriesFromClaims(FIXTURE_CLAIMS, {
    cvSourceUrl: 'fixture://graham-class-cv',
  });
  console.log(`Education entries: ${entries.length}`);
  for (const entry of entries) {
    console.log(
      ` - ${entry.degreeKind} @ ${entry.institution} (${entry.graduationYear ?? '?'}) program=${entry.program ?? entry.fieldOfStudy ?? 'n/a'}`,
    );
  }

  const fetchNotes: string[] = [];
  for (const url of CANDIDATE_URLS) {
    try {
      const page = await fetcher.fetchPage(url);
      fetchNotes.push(
        `${url} → status=${page.status} bytes=${(page.text ?? '').length} title=${(page.title ?? '').slice(0, 80)} note=${page.note ?? ''}`,
      );
    } catch (error) {
      fetchNotes.push(
        `${url} → error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  console.log('\nOfficial source reachability:');
  for (const note of fetchNotes) console.log(`  ${note}`);

  const dossier = await assessProgramAccreditation({
    entries,
    specialty: 'Clinical Psychology',
    search: async (query) => {
      // Prefer direct official hosts when SERP keys are absent.
      const lower = query.toLowerCase();
      if (lower.includes('accreditation.apa.org') || lower.includes('apa.org')) {
        return [
          {
            url: 'https://accreditation.apa.org/',
            title: 'APA Accreditation',
            snippet:
              'APA Commission on Accreditation — find accredited programs database portal.',
          },
        ];
      }
      if (lower.includes('chea.org')) {
        return [
          {
            url: 'https://www.chea.org/',
            title: 'CHEA',
            snippet: 'Council for Higher Education Accreditation.',
          },
        ];
      }
      if (lower.includes('ope.ed.gov')) {
        return [
          {
            url: 'https://ope.ed.gov/dapip/#/home',
            title: 'USDE DAPIP',
            snippet: 'U.S. Department of Education accreditation database.',
          },
        ];
      }
      return [];
    },
    fetchPage: async (url) => {
      try {
        const page = await fetcher.fetchPage(url);
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

  console.log(`\nAssessments: ${dossier.assessments.length}`);
  for (const a of dossier.assessments) {
    console.log(
      ` - ${a.entry.institution} / ${a.entry.degreeName ?? a.entry.degreeKind}: APA=${a.apaStatus} institutional=${a.institutionalStatus ?? 'n/a'}`,
    );
    console.log(`   ${a.explanation}`);
    if (a.apaEvidence?.url) console.log(`   APA evidence: ${a.apaEvidence.url}`);
    if (a.institutionalEvidence?.url) {
      console.log(`   Institutional evidence: ${a.institutionalEvidence.url}`);
    }
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
