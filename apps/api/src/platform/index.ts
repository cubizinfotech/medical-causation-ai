export { PlatformModule } from './platform.module';
export { PRODUCTS, PRODUCT_PERMISSION_PREFIX } from './products';
export type { ProductId } from './products';
export {
  QUEUE_PREFIXES,
  REDIS_KEY_PREFIXES,
  COMMON_JOB_STATUS,
} from './jobs/job.types';
export type {
  CommonJobStatus,
  CommonJobProgressUpdate,
} from './jobs/job.types';
export type { AuthUserRef, IAuthService } from './auth/auth.types';
export type {
  PlatformRole,
  PlatformUser,
  IUserService,
} from './users/user.types';
export type { EmailMessage, IEmailService } from './email/email.types';
export type { AuditEvent, IAuditService } from './audit/audit.types';
export type {
  ReportFormat,
  ReportArtifact,
  IReportBuilder,
} from './report/report.types';
export type { StorageLocation, IObjectStorage } from './storage/storage.types';
export type {
  ResearchQuery,
  ResearchHit,
  ResearchSourceResult,
  IResearchSource,
} from './search/research-source.types';
export { PLATFORM_LOG_CONTEXT } from './logging/logging.constants';
