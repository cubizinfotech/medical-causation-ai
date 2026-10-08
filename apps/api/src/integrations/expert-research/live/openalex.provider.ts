import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import type {
  ExpertIdentityResolver,
  ResolvedExpertIdentity,
} from './identity-resolver';
import { LiveResearchProvider, type LiveRunResult } from './live-provider.base';
import { citiesMatch, parseCityState, stateName } from './location';
import {
  shortId,
  type OpenAlexAuthor,
  type OpenAlexClient,
  type OpenAlexInstitution,
  type OpenAlexWork,
} from './openalex.client';
import {
  displayName,
  namesCompatible,
  parsePersonName,
  type PersonName,
} from './person-name';
import { specialtyOverlaps, specialtyStems } from './specialty-match';

const TOP_CITED = 10;
const RECENT = 5;
const RETRACTED = 25;

const PROFILE_NOTE =
  'OpenAlex builds author profiles automatically and can merge or split people with similar names. Confirm key publications against the expert’s CV.';

interface Place {
  cities: string[];
  /** Full state names, e.g. "Arizona". */
  states: string[];
}

interface Candidate {
  author: OpenAlexAuthor;
  matchedTopics: string[];
  matchedInstitutions: string[];
}

/**
 * OpenAlex publications. An author profile is used only when the name, the
 * research topics, and an affiliated institution's location all fit.
 */
export class OpenAlexResearchProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly resolver: ExpertIdentityResolver,
    private readonly client: OpenAlexClient,
  ) {
    super(definition);
  }

  protected async run(
    query: ExpertResearchQuery,
    retrievedAt: string,
  ): Promise<LiveRunResult> {
    const name = parsePersonName(query.expertName);
    if (!name) {
      return {
        items: [],
        status: 'unavailable',
        message:
          'Not searched. OpenAlex needs the expert’s first and last name to match an author profile.',
      };
    }
    if (specialtyStems(query.specialty).length === 0) {
      return {
        items: [],
        status: 'unavailable',
        message: `Not searched. “${query.specialty}” is too general to tell same-name authors apart by research topic.`,
      };
    }

    const identity = await this.identity(query);
    const place = placeFor(query, identity);
    const authors = (
      await this.client.searchAuthors(`${name.first} ${name.last}`)
    ).filter((author) => authorNamed(author, name));
    if (authors.length === 0) {
      return {
        items: [],
        message: `OpenAlex has no author profile named ${displayName(name)}.`,
      };
    }

    const institutions = await this.client.institutions(
      authors.flatMap((author) => institutionIds(author)),
    );
    const byId = new Map(
      institutions.map((institution) => [shortId(institution.id), institution]),
    );
    const candidates = authors
      .map((author) => candidateFor(author, query.specialty, place, byId))
      .filter((candidate): candidate is Candidate => candidate !== null);
    const where = describePlace(place);

    if (candidates.length === 0) {
      return {
        items: [],
        message: `${authors.length} OpenAlex author profile(s) are named ${displayName(name)}, but none has both ${query.specialty} research topics and an institution in ${where}. Nothing was attributed to the expert.`,
      };
    }
    const chosen = sameOrcid(candidates);
    if (!chosen) {
      return {
        items: [],
        outcome: 'conflicting',
        message: `${candidates.length} OpenAlex author profiles fit the name, ${query.specialty} topics, and ${where}: ${candidates
          .map(
            (candidate) =>
              `${candidate.author.display_name} (${candidate.matchedInstitutions.join(', ') || 'institution not listed'}; ${candidate.author.works_count ?? 0} works; ${candidate.author.id})`,
          )
          .join(
            '; ',
          )}. They could not be told apart, so no publications were attributed to the expert.`,
      };
    }

    const authorIdentity = {
      name: chosen.author.display_name ?? query.expertName,
      city: query.city,
      specialty: query.specialty,
      verifiedBy: 'source_match',
      basis: ['name', 'research topics', 'institution location'],
      openalexId: chosen.author.id,
    };
    const [topCited, recent, retracted] = await Promise.all([
      this.client.works(chosen.author.id, {
        sort: 'cited_by_count:desc',
        perPage: TOP_CITED,
      }),
      this.client.works(chosen.author.id, {
        sort: 'publication_date:desc',
        perPage: RECENT,
      }),
      this.client.works(chosen.author.id, {
        sort: 'publication_date:desc',
        perPage: RETRACTED,
        retractedOnly: true,
      }),
    ]);
    const works = dedupeWorks([
      ...retracted.works,
      ...topCited.works,
      ...recent.works,
    ]);
    const items: ExpertEvidenceItem[] = [
      this.profileItem(chosen, authorIdentity, retracted.count, retrievedAt),
      ...works.map((work) =>
        this.workItem(work, chosen.author.id, authorIdentity, retrievedAt),
      ),
    ];
    return {
      items,
      message: `Matched OpenAlex author ${chosen.author.display_name} (${chosen.author.works_count ?? 0} works) on name, ${chosen.matchedTopics[0] ?? query.specialty} topics, and ${chosen.matchedInstitutions[0] ?? where}.${retracted.count > 0 ? ` ${retracted.count} work(s) are marked retracted.` : ''}`,
    };
  }

  private async identity(
    query: ExpertResearchQuery,
  ): Promise<ResolvedExpertIdentity | null> {
    try {
      return await this.resolver.resolve(query);
    } catch {
      // The registry only adds a state anchor here; the city still applies.
      return null;
    }
  }

  private profileItem(
    candidate: Candidate,
    identity: Record<string, unknown>,
    retractedCount: number,
    retrievedAt: string,
  ): ExpertEvidenceItem {
    const author = candidate.author;
    const hIndex = author.summary_stats?.h_index;
    const institutions = (author.last_known_institutions ?? [])
      .map((institution) => institution.display_name)
      .filter(Boolean);
    const topics = (author.topics ?? [])
      .slice(0, 5)
      .map((topic) => topic.display_name)
      .filter(Boolean);
    const summary = [
      `${author.works_count ?? 0} works, cited ${author.cited_by_count ?? 0} times${hIndex !== undefined ? `, h-index ${hIndex}` : ''}.`,
      institutions.length > 0
        ? `Last known institution(s): ${institutions.join('; ')}.`
        : null,
      topics.length > 0 ? `Main topics: ${topics.join('; ')}.` : null,
      author.orcid ? `ORCID: ${author.orcid}.` : null,
      retractedCount > 0
        ? `${retractedCount} work(s) are marked retracted in OpenAlex.`
        : 'No work is marked retracted in OpenAlex.',
      `Matched on name, research topics (${candidate.matchedTopics.slice(0, 2).join('; ')}), and institution location (${candidate.matchedInstitutions.slice(0, 2).join('; ')}).`,
      PROFILE_NOTE,
    ]
      .filter(Boolean)
      .join(' ');
    return this.item({
      category: 'profile',
      title: `OpenAlex author profile: ${author.display_name}`,
      summary,
      url: author.id,
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        identity,
        openalexId: author.id,
        orcid: author.orcid ?? null,
        worksCount: author.works_count ?? 0,
        citedByCount: author.cited_by_count ?? 0,
        hIndex: hIndex ?? null,
        retractedCount,
        institutions,
        topics,
        verificationNote: PROFILE_NOTE,
        evidenceReference: `OpenAlex author ${shortId(author.id)}`,
      },
    });
  }

  private workItem(
    work: OpenAlexWork,
    authorId: string,
    identity: Record<string, unknown>,
    retrievedAt: string,
  ): ExpertEvidenceItem {
    const authors = work.authorships ?? [];
    const own = authors.find(
      (authorship) =>
        authorship.author?.id &&
        shortId(authorship.author.id) === shortId(authorId),
    );
    const position = own?.author_position ?? null;
    const authorship =
      position === 'first'
        ? 'First author'
        : position === 'last'
          ? 'Last (senior) author'
          : position === 'middle'
            ? 'Middle author'
            : null;
    const names = authors
      .map((authorshipEntry) => authorshipEntry.author?.display_name)
      .filter((value): value is string => Boolean(value));
    const authorList =
      names.length > 6
        ? `${names.slice(0, 6).join(', ')}, et al. (${names.length} authors)`
        : names.join(', ');
    const journal = work.primary_location?.source?.display_name ?? null;
    const title = work.title?.trim() || 'Untitled work';
    const retracted = work.is_retracted === true;
    const summary = [
      retracted ? 'OpenAlex marks this work as retracted.' : null,
      [journal, work.publication_year].filter(Boolean).join(', ') || null,
      authorship
        ? `${authorship} of ${authors.length} author(s).`
        : `Author position not stated (${authors.length} author(s)).`,
      `Cited ${work.cited_by_count ?? 0} times.`,
    ]
      .filter(Boolean)
      .join(' ');
    return this.item({
      category: 'publication',
      title: retracted ? `RETRACTED: ${title}` : title,
      summary,
      url: work.doi ?? work.id,
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        identity,
        openalexWorkId: work.id,
        publicationTitle: title,
        authors: authorList,
        publicationDate: work.publication_date ?? null,
        year: work.publication_year ?? null,
        journal,
        ...(position ? { authorPosition: position } : {}),
        authorship,
        retracted,
        retractionStatus: retracted
          ? 'Retracted (OpenAlex)'
          : 'Not marked retracted in OpenAlex',
        citedByCount: work.cited_by_count ?? 0,
        doi: work.doi ?? null,
        workType: work.type ?? null,
        evidenceReference: `OpenAlex work ${shortId(work.id)}`,
      },
    });
  }
}

function authorNamed(author: OpenAlexAuthor, name: PersonName): boolean {
  return [author.display_name, ...(author.display_name_alternatives ?? [])]
    .map((value) => (value ? parsePersonName(value) : null))
    .some((other) => other !== null && namesCompatible(other, name));
}

function institutionIds(author: OpenAlexAuthor): string[] {
  return [
    ...(author.last_known_institutions ?? []).map(
      (institution) => institution.id,
    ),
    ...(author.affiliations ?? [])
      .map((affiliation) => affiliation.institution?.id)
      .filter((id): id is string => Boolean(id)),
  ];
}

function placeFor(
  query: ExpertResearchQuery,
  identity: ResolvedExpertIdentity | null,
): Place {
  const parsed = parseCityState(query.city);
  const cities = [parsed.city];
  const states = new Set<string>();
  const queryState = stateName(parsed.state);
  if (queryState) states.add(queryState);
  for (const location of identity?.record?.locations ?? []) {
    cities.push(location.city);
    const name = stateName(location.state);
    if (name) states.add(name);
  }
  return { cities, states: [...states] };
}

function describePlace(place: Place): string {
  return place.states.length > 0
    ? `${place.cities[0]} or ${place.states.join('/')}`
    : place.cities[0];
}

function candidateFor(
  author: OpenAlexAuthor,
  specialty: string,
  place: Place,
  institutions: Map<string, OpenAlexInstitution>,
): Candidate | null {
  const matchedTopics = (author.topics ?? [])
    .slice(0, 10)
    .filter((topic) =>
      specialtyOverlaps(
        specialty,
        [
          topic.display_name,
          topic.subfield?.display_name,
          topic.field?.display_name,
        ]
          .filter(Boolean)
          .join(' '),
      ),
    )
    .map((topic) => topic.display_name ?? '')
    .filter(Boolean);
  if (matchedTopics.length === 0) return null;
  const matchedInstitutions = [
    ...new Set(
      institutionIds(author)
        .map((id) => institutions.get(shortId(id)))
        .filter((institution): institution is OpenAlexInstitution =>
          Boolean(institution && inPlace(institution, place)),
        )
        .map((institution) => {
          const geo = institution.geo;
          return `${institution.display_name} (${[geo?.city, geo?.region].filter(Boolean).join(', ')})`;
        }),
    ),
  ];
  if (matchedInstitutions.length === 0) return null;
  return { author, matchedTopics, matchedInstitutions };
}

function inPlace(institution: OpenAlexInstitution, place: Place): boolean {
  const geo = institution.geo;
  if (!geo) return false;
  if (geo.city && place.cities.some((city) => citiesMatch(geo.city!, city))) {
    return true;
  }
  return Boolean(
    geo.region &&
    geo.country_code === 'US' &&
    place.states.some(
      (state) => state.toLowerCase() === geo.region!.toLowerCase(),
    ),
  );
}

/** Several profiles of one person share an ORCID; keep the largest. */
function sameOrcid(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 1) return candidates[0];
  const orcids = new Set(candidates.map((candidate) => candidate.author.orcid));
  if (orcids.size !== 1 || !candidates[0].author.orcid) return null;
  return candidates
    .slice()
    .sort(
      (left, right) =>
        (right.author.works_count ?? 0) - (left.author.works_count ?? 0),
    )[0];
}

function dedupeWorks(works: OpenAlexWork[]): OpenAlexWork[] {
  const seen = new Set<string>();
  return works.filter((work) => {
    if (seen.has(work.id)) return false;
    seen.add(work.id);
    return true;
  });
}
