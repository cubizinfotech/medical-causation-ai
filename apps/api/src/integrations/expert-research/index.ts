export * from './expert-research.types';
export * from './expert-research.service';
export * from './expert-research.module';
export * from './providers/provider-catalog';
export * from './providers/provider-runtime';
export * from './providers/catalog-expert-research.provider';
export * from './providers/information-status';
export * from './providers/identity-match';
export * from './providers/public-affiliation';
export * from './providers/research-outcome';
export * from './live/live-sources';
export type {
  PublicationLookupResult,
  PublicationLookupStatus,
  PublicationQuery,
  CatalogCheck,
  ScholarlyType,
} from './live/publication-lookup';
export { authorPositionIn, describePosition } from './live/author-position';
export {
  captionFromDocketUrl,
  captionSlugIsReliable,
  resolveCaseCaption,
} from './live/case-caption';
export type { CaptionStatus } from './live/case-caption';
export type { AuthorPosition } from './live/author-position';
export { articleTitle, sameTitle, yearsAgree } from './live/publication-lookup';
export {
  classifyPublicationType,
  normalizeDoi,
  parsePmid,
  parseYear,
  scholarlyTypeLabel,
} from './live/publication-citation';
export { specialtyMatches, taxonomyMatches } from './live/specialty-match';
export { stateCode, stateName } from './live/location';
export { namesCompatible, parsePersonName } from './live/person-name';
