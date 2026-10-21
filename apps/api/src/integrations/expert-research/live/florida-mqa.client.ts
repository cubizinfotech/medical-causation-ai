import { LiveHttpError } from './live-http';

export const FLORIDA_MQA_SEARCH =
  'https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders';

export interface FloridaLicenseHit {
  name: string;
  licenseNumber: string;
  profession: string;
  status: string;
  city: string | null;
  disciplineOnFile: boolean | null;
  url: string;
}

export interface FloridaMqaLookup {
  hits: FloridaLicenseHit[];
  blocked: boolean;
  message?: string;
  searchUrl: string;
}

const PREFIX_PROFESSION: Record<string, string> = {
  PY: 'Psychologist',
  ME: 'Medical Doctor',
  OS: 'Osteopathic Physician',
  DN: 'Dentist',
  RN: 'Registered Nurse',
  PA: 'Physician Assistant',
  CH: 'Chiropractic Physician',
};

/**
 * Official Florida DOH MQA license verification. Bot walls and login
 * redirects are reported as blocked, not as an empty search.
 */
export class FloridaMqaClient {
  private readonly cache = new Map<string, Promise<FloridaMqaLookup>>();

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 20000,
  ) {}

  lookup(input: {
    lastName: string;
    firstName?: string;
    licenseNumber?: string;
  }): Promise<FloridaMqaLookup> {
    const key = [
      input.licenseNumber?.toUpperCase() ?? '',
      input.lastName.toLowerCase(),
      input.firstName?.toLowerCase() ?? '',
    ].join('|');
    const cached = this.cache.get(key);
    if (cached) return cached;
    const pending = this.request(input);
    this.cache.set(key, pending);
    pending.catch(() => this.cache.delete(key));
    return pending;
  }

  private async request(input: {
    lastName: string;
    firstName?: string;
    licenseNumber?: string;
  }): Promise<FloridaMqaLookup> {
    const params = new URLSearchParams();
    if (input.licenseNumber) params.set('LicenseNumber', input.licenseNumber);
    if (input.lastName) params.set('LastName', input.lastName);
    if (input.firstName) params.set('FirstName', input.firstName);
    const profession = professionForLicense(input.licenseNumber);
    if (profession) params.set('ProfessionName', profession);
    const searchUrl = `${FLORIDA_MQA_SEARCH}?${params.toString()}`;
    const response = await this.read(FLORIDA_MQA_SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (response.status >= 300 && response.status < 400) {
      return {
        hits: [],
        blocked: true,
        searchUrl,
        message:
          'The Florida Department of Health license lookup redirected the request (access wall). The page was not followed. Look the license up manually at the official site. This is not a finding that the license is invalid.',
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        hits: [],
        blocked: true,
        searchUrl,
        message:
          'The Florida Department of Health license lookup blocked the request (access wall). Look the license up manually at the official site. This is not a finding that the license is invalid.',
      };
    }
    if (!response.status.toString().startsWith('2')) {
      throw new LiveHttpError(
        `Florida license lookup returned HTTP ${response.status}. This is not a finding that the license is invalid.`,
        response.status === 429 ? 'rate_limited' : 'http',
        response.status,
      );
    }
    if (!pageIsReadable(response.body)) {
      return {
        hits: [],
        blocked: true,
        searchUrl,
        message:
          'The Florida Department of Health license lookup presented a bot-protection or access wall. The page was not read. Look the license up manually. This is not a finding that the license is invalid or that no discipline exists.',
      };
    }
    return {
      hits: parseFloridaLicenseHits(response.body, searchUrl),
      blocked: false,
      searchUrl,
    };
  }

  private async read(
    url: string,
    init?: RequestInit,
  ): Promise<{ status: number; body: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        ...init,
        headers: {
          Accept: 'text/html',
          'User-Agent':
            'medical-causation-ai/1.0 (expert witness research; public records)',
          ...(init?.headers ?? {}),
        },
        signal: controller.signal,
        redirect: 'manual',
      });
      const body = await response.text();
      return { status: response.status, body };
    } catch (error) {
      if (error instanceof LiveHttpError) throw error;
      throw new LiveHttpError(
        'The Florida license lookup could not be reached. This is not a finding about the license.',
        'network',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export function professionForLicense(number?: string): string | undefined {
  if (!number) return undefined;
  const prefix = number
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 2)
    .toUpperCase();
  return PREFIX_PROFESSION[prefix];
}

export function pageIsReadable(html: string): boolean {
  if (html.length < 200) return false;
  const lower = html.toLowerCase();
  if (
    lower.includes('cf-browser-verification') ||
    lower.includes('just a moment') ||
    lower.includes('enable javascript and cookies') ||
    lower.includes('access denied')
  ) {
    return false;
  }
  return true;
}

/** Parses the public MQA results table; unknown markup yields no hits. */
export function parseFloridaLicenseHits(
  html: string,
  searchUrl: string,
): FloridaLicenseHit[] {
  const hits: FloridaLicenseHit[] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowPattern.exec(html)) !== null) {
    const cells = [
      ...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi),
    ].map((cell) =>
      cell[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
    if (cells.length < 3) continue;
    if (/^name$/i.test(cells[0]) || /license/i.test(cells[0])) continue;
    const license = cells.find((cell) => /^[A-Z]{1,3}\d{3,8}$/i.test(cell));
    if (!license) continue;
    const name = cells[0];
    if (name.length < 3) continue;
    const profession =
      cells.find((cell) =>
        /psycholog|physician|nurs|dentist|chiro/i.test(cell),
      ) ?? '';
    const status =
      cells.find((cell) =>
        /active|clear|delinquent|null|revoked|suspended|retired|inactive/i.test(
          cell,
        ),
      ) ?? '';
    const city =
      cells.find(
        (cell) =>
          /^[A-Z][A-Za-z .'-]+$/.test(cell) &&
          cell !== name &&
          cell !== profession &&
          cell !== status &&
          !/psycholog|physician|nurs|dentist|chiro|active|clear|delinquent|revoked|suspended|retired|inactive/i.test(
            cell,
          ),
      ) ?? null;
    const disciplineCell = cells.find((cell) => /^(Y|N|Yes|No)$/i.test(cell));
    const detail = row[1].match(/LicenseVerification\?[^"'>\s]+/i);
    hits.push({
      name,
      licenseNumber: license.toUpperCase(),
      profession,
      status,
      city,
      disciplineOnFile:
        disciplineCell == null ? null : /^Y|Yes$/i.test(disciplineCell),
      url: detail
        ? `https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders/${detail[0]}`
        : searchUrl,
    });
  }
  return hits;
}
