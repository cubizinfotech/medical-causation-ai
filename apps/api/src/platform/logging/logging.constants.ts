/**
 * Logging helpers / constants for shared platform code.
 * Nest Logger remains the runtime default; swap to Pino/Winston later behind this surface.
 */
export const PLATFORM_LOG_CONTEXT = {
  AUTH: 'Auth',
  AUDIT: 'Audit',
  EMAIL: 'Email',
  JOBS: 'Jobs',
  STORAGE: 'Storage',
  SEARCH: 'Search',
} as const;
