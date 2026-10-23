import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function repoFile(name: string): string {
  const candidates = [
    join(process.cwd(), '..', '..', name),
    join(__dirname, '../../../..', name),
    join(process.cwd(), name),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new Error(`Could not find ${name} from ${process.cwd()}`);
  }
  return found;
}

function parseAssignments(contents: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const cut = line.indexOf('=');
    if (cut <= 0) continue;
    values.set(line.slice(0, cut).trim(), line.slice(cut + 1).trim());
  }
  return values;
}

const SECRET_SHAPE = /^(sk-ant-|sk-or-|gsk_|mstrl_|re_|AQ\.|ya29\.|AIza)/i;

const REQUIRED_RUNTIME_KEYS = [
  'NODE_ENV',
  'NEXT_PUBLIC_API_URL',
  'FRONTEND_URL',
  'API_PUBLIC_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'POSTGRES_PORT',
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'AI_PROVIDER',
  'EMBEDDING_PROVIDER',
  'KNOWLEDGE_BASE_PATH',
  'CASE_RECORDS_PATH',
  'EWI_DOCUMENTS_PATH',
  'RESEARCH_PROVIDER',
  'EMAIL_PROVIDER',
  'EMAIL_DELIVERY_ENABLED',
  'API_PORT',
];

const READ_AND_PREVIOUSLY_OMITTED = [
  'WEB_SEARCH_MAX_PAGES',
  'RESEARCH_MIN_INTERVAL_MS',
  'CROSSREF_MAILTO',
  'RESEARCH_CACHE_TTL_SECONDS',
  'JOB_LOCK_MS',
  'JOB_MAX_STALLED_COUNT',
  'ORCID_CLIENT_ID',
  'ORCID_CLIENT_SECRET',
  'ORCID_REDIRECT_URI',
];

const UNUSED_CATALOG_ENV = [
  'WEB_SEARCH_API_KEY',
  'USPTO_API_KEY',
  'LEXISNEXIS_API_KEY',
  'EXPERT_DIRECTORY_API_KEY',
  'DRI_API_KEY',
  'SEAK_API_KEY',
  'ALM_API_KEY',
  'JURISPRO_API_KEY',
  'EXPERTLAW_API_KEY',
  'EXPERTPAGES_API_KEY',
  'EXPERTWITNESS_API_KEY',
  'OTHER_DIRECTORY_API_KEY',
  'ADVERTISING_DIRECTORY_API_KEY',
  'IME_DIRECTORY_API_KEY',
  'SOCIAL_API_KEY',
  'NEWS_API_KEY',
  'GOOGLE_MAPS_API_KEY',
  'CRIMINAL_RECORDS_API_KEY',
  'MALPRACTICE_RECORDS_API_KEY',
] as const;

describe('.env.example', () => {
  const path = repoFile('.env.example');
  const contents = readFileSync(path, 'utf8');
  const values = parseAssignments(contents);

  it('documents required runtime variables', () => {
    for (const key of REQUIRED_RUNTIME_KEYS) {
      expect(values.has(key)).toBe(true);
    }
  });

  it('documents research limits that the API actually reads', () => {
    for (const key of READ_AND_PREVIOUSLY_OMITTED) {
      expect(contents).toContain(key);
    }
    expect(values.get('WEB_SEARCH_MAX_PAGES')).toBe('150');
    expect(values.get('RESEARCH_MIN_INTERVAL_MS')).toBe('0');
    expect(values.get('JOB_LOCK_MS')).toBe('1800000');
    expect(values.get('JOB_MAX_STALLED_COUNT')).toBe('1');
    expect(values.get('ORCID_CLIENT_ID')).toBe('');
    expect(values.get('ORCID_CLIENT_SECRET')).toBe('');
    expect(values.get('ORCID_REDIRECT_URI')).toBe('');
  });

  it('uses safe example defaults for research and email', () => {
    expect(values.get('RESEARCH_PROVIDER')).toBe('mock');
    expect(values.get('EMAIL_PROVIDER')).toBe('console');
    expect(values.get('EMAIL_DELIVERY_ENABLED')).toBe('false');
    expect(values.get('EWI_REQUEST_WORKFLOW_ENABLED')).toBe('false');
    expect(values.get('EWI_REQUEST_AUTO_SEND')).toBe('false');
    expect(values.get('JWT_SECRET')).toBe('');
    expect(values.get('SERPER_API_KEY')).toBe('');
    expect(values.get('BRAVE_SEARCH_API_KEY')).toBe('');
    expect(values.get('TAVILY_API_KEY')).toBe('');
    expect(values.get('YOUTUBE_API_KEY')).toBe('');
    expect(values.get('YOUTUBE_MAX_RESULTS')).toBe('25');
    expect(values.get('EWI_TRANSCRIPTION_ENABLED')).toBe('true');
    expect(values.get('EWI_TRANSCRIPTION_MAX_FILES')).toBe('2');
    expect(values.get('WEB_FETCH_MAX_PAGES')).toBe('80');
    expect(values.get('WEB_SEARCH_MAX_QUERIES')).toBe('64');
    expect(values.get('ASSEMBLYAI_API_KEY')).toBe('');
    expect(values.get('COURTLISTENER_API_TOKEN')).toBe('');
    expect(values.get('OPENALEX_API_KEY')).toBe('');
    expect(values.get('PUBMED_API_KEY')).toBe('');
    expect(values.has('NCBI_API_KEY')).toBe(false);
    expect(contents).toContain('NCBI_API_KEY');
    expect(values.has('COURTLISTENER_API_KEY')).toBe(false);
    expect(contents).toContain('COURTLISTENER_API_KEY');
    expect(contents).toMatch(/LEXIS_STORAGE_ENABLED=false/);
    expect(values.get('LEXIS_STORAGE_ENABLED')).toBeUndefined();
  });

  it('contains no real-looking secrets in assigned values', () => {
    for (const [, value] of values) {
      expect(value).not.toMatch(SECRET_SHAPE);
    }
    expect(contents).not.toMatch(/sk-ant-api|sk-or-v1-|gsk_/);
  });

  it('identifies unused catalog credential names as reserved, not as live keys', () => {
    for (const name of UNUSED_CATALOG_ENV) {
      expect(values.has(name)).toBe(false);
      expect(contents).toContain(name);
    }
    expect(contents).toMatch(/Reserved catalog labels/i);
  });
});

describe('environment files stay out of Git', () => {
  it('ignores .env and .env.live and keeps .env.example tracked', () => {
    const gitignore = readFileSync(repoFile('.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^\.env$/m);
    expect(gitignore).toMatch(/^\.env\.live$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });
});
