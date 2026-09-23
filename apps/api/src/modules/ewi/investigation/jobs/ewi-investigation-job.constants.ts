export const EWI_INVESTIGATION_QUEUE_NAME = 'ewi-investigation';

export const EWI_JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type EwiJobStatus = (typeof EWI_JOB_STATUS)[keyof typeof EWI_JOB_STATUS];

export {
  EWI_JOB_STEP_LABELS,
  EWI_STAGE_IDENTIFY,
  EWI_STAGE_REPORT,
  EWI_WORKFLOW_STAGES,
} from '../workflow/investigation-stages';

export type { EwiWorkflowStageId as EwiJobStep } from '../workflow/investigation-stages';
