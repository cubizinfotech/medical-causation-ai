import type {
  ExpertResearchProviderId,
  ExpertResearchQuery,
  InformationStatus,
  SourceAccessClass,
} from '../expert-research.types';

export interface DevelopmentFixture {
  category: string;
  title: string;
  summary: string;
  url?: string;
  access: SourceAccessClass;
  informationStatus: InformationStatus;
  raw?: Record<string, unknown>;
}

const FIXTURE_NOTE =
  'Development fixture only. This is not a retrieved record and does not establish a credential, publication, case, license, or award.';

/**
 * Local fixtures for the investigation workflow.
 * Providers omitted here return unavailable and contribute no items.
 */
export function developmentFixtures(
  query: ExpertResearchQuery,
): Partial<Record<ExpertResearchProviderId, DevelopmentFixture[]>> {
  const { expertName, specialty } = query;
  return {
    web_search: [
      {
        category: 'profile',
        title: `Development fixture: web search for ${expertName}`,
        summary: `${FIXTURE_NOTE} Specialty context: ${specialty}.`,
        url: 'https://example.local/search',
        access: 'public',
        informationStatus: 'unverified',
        raw: { fixture: true },
      },
    ],
    pubmed: [
      {
        category: 'publication',
        title: `Development fixture: sample ${specialty} citation`,
        summary: FIXTURE_NOTE,
        url: 'https://pubmed.example.local/000000',
        access: 'public',
        informationStatus: 'unverified',
        raw: { fixture: true },
      },
    ],
    author_verification: [
      {
        category: 'publication',
        title: 'Development fixture: curriculum vitae publication list',
        summary: `${FIXTURE_NOTE} Sample counts are included so discrepancy rules can be exercised.`,
        access: 'public',
        informationStatus: 'unverified',
        raw: { fixture: true, cvCount: 42, indexedCount: 38 },
      },
    ],
    state_license: [
      {
        category: 'license',
        title: 'Development fixture: state medical license',
        summary: FIXTURE_NOTE,
        url: 'https://example.local/boards/ca',
        access: 'public',
        informationStatus: 'unverified',
        raw: { fixture: true, status: 'active', state: 'CA' },
      },
    ],
    expert_website: [
      {
        category: 'license',
        title: 'Development fixture: website credential claim',
        summary: `${FIXTURE_NOTE} Sample website text claims more than one state.`,
        url: 'https://example.local/experts/about',
        access: 'public',
        informationStatus: 'unverified',
        raw: {
          fixture: true,
          claimedStates: ['CA', 'NY'],
          claimedBoard: specialty,
        },
      },
    ],
    courtlistener: [
      {
        category: 'legal',
        title: 'Development fixture: court opinion link',
        summary: FIXTURE_NOTE,
        url: 'https://www.courtlistener.com/example',
        access: 'public',
        informationStatus: 'unverified',
        raw: { fixture: true },
      },
    ],
    expert_directory: [
      {
        category: 'directory',
        title: 'Development fixture: expert directory listing',
        summary: FIXTURE_NOTE,
        access: 'restricted',
        informationStatus: 'unverified',
        raw: { fixture: true },
      },
    ],
    news: [
      {
        category: 'news',
        title: `Development fixture: news mention of ${expertName}`,
        summary: FIXTURE_NOTE,
        access: 'public',
        informationStatus: 'unverified',
        raw: { fixture: true },
      },
    ],
    patents: [
      {
        category: 'patent',
        title: 'Development fixture: patent search',
        summary: FIXTURE_NOTE,
        access: 'public',
        informationStatus: 'unverified',
        raw: { fixture: true },
      },
    ],
    lexisnexis: [
      {
        category: 'legal',
        title: 'Development fixture: LexisNexis link',
        summary: 'Licensed opinion text that must not be stored.',
        url: 'https://advance.lexis.com/example',
        access: 'restricted',
        informationStatus: 'unverified',
        raw: { fixture: true, fullText: 'opinion body' },
      },
    ],
  };
}
