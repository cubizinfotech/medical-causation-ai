import type {
  ExpertEvidenceItem,
  ExpertResearchQuery,
  ProviderDefinition,
} from '../expert-research.types';
import { fetchJson } from './live-http';
import { LiveResearchProvider, type LiveRunResult } from './live-provider.base';
import { parseCityState } from './location';
import { parsePersonName, type PersonName } from './person-name';

const MAX_GRANTS = 10;
const REPORTER_URL = 'https://api.reporter.nih.gov/v2/projects/search';

interface ReporterPi {
  first_name?: string;
  last_name?: string;
}

interface ReporterProject {
  appl_id?: number;
  project_num?: string;
  project_title?: string;
  fiscal_year?: number;
  award_amount?: number;
  organization?: { org_name?: string; org_city?: string; org_state?: string };
  principal_investigators?: ReporterPi[];
  agency_ic_admin?: { abbreviation?: string };
}

/**
 * NIH RePORTER. A project is listed only when a principal investigator’s
 * last name and first initial match. Organization location is quoted, not
 * treated as proof of identity by itself.
 */
export class NihReporterResearchProvider extends LiveResearchProvider {
  constructor(
    definition: ProviderDefinition,
    private readonly fetchImpl: typeof fetch | undefined,
    private readonly timeoutMs: number,
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
          'Not searched. NIH RePORTER needs the expert’s first and last name.',
      };
    }
    const payload = await fetchJson<{ results?: ReporterProject[] }>(
      REPORTER_URL,
      {
        timeoutMs: this.timeoutMs,
        fetchImpl: this.fetchImpl,
        method: 'POST',
        body: {
          criteria: {
            pi_names: [{ last_name: name.last, first_name: name.first }],
          },
          offset: 0,
          limit: MAX_GRANTS,
          sort_field: 'fiscal_year',
          sort_order: 'desc',
        },
      },
    );
    const state = parseCityState(query.city).state;
    const items = (payload.results ?? [])
      .filter((project) =>
        (project.principal_investigators ?? []).some((pi) =>
          piMatches(pi, name),
        ),
      )
      .map((project) => this.grantItem(project, state, retrievedAt));
    if (items.length === 0) {
      return {
        items: [],
        message: `NIH RePORTER has no projects whose principal investigator matches ${name.first} ${name.last}.`,
      };
    }
    return {
      items,
      message: `${items.length} NIH RePORTER project(s) list a principal investigator matching this name. Confirm the organization before treating a grant as this expert’s.`,
    };
  }

  private grantItem(
    project: ReporterProject,
    queryState: string | null,
    retrievedAt: string,
  ): ExpertEvidenceItem {
    const org = project.organization;
    const place = [org?.org_city, org?.org_state].filter(Boolean).join(', ');
    const sameState =
      queryState !== null &&
      org?.org_state?.toUpperCase() === queryState.toUpperCase();
    const url =
      typeof project.appl_id === 'number'
        ? `https://reporter.nih.gov/project-details/${project.appl_id}`
        : undefined;
    return this.item({
      category: 'grant',
      title:
        project.project_title?.trim() || project.project_num || 'NIH project',
      summary: [
        project.project_num ? `Project ${project.project_num}.` : null,
        project.fiscal_year ? `Fiscal year ${project.fiscal_year}.` : null,
        project.agency_ic_admin?.abbreviation
          ? `Agency ${project.agency_ic_admin.abbreviation}.`
          : null,
        org?.org_name
          ? `Organization: ${org.org_name}${place ? ` (${place})` : ''}.`
          : null,
        typeof project.award_amount === 'number'
          ? `Award amount reported by NIH: ${project.award_amount}.`
          : null,
        sameState
          ? 'The organization state matches the state in the investigation.'
          : 'The organization location was not confirmed as this expert’s practice state.',
      ]
        .filter(Boolean)
        .join(' '),
      url,
      retrievedAt,
      informationStatus: 'unverified',
      raw: {
        projectNum: project.project_num ?? null,
        applId: project.appl_id ?? null,
        fiscalYear: project.fiscal_year ?? null,
        organization: org?.org_name ?? null,
      },
    });
  }
}

function piMatches(pi: ReporterPi, name: PersonName): boolean {
  const last = pi.last_name?.toLowerCase().trim();
  const first = pi.first_name?.toLowerCase().trim() ?? '';
  return last === name.last && first.startsWith(name.first[0]);
}
