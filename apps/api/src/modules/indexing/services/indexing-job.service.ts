import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { INDEXING_JOB_STATUS, INDEXING_JOB_TYPE } from '../constants';
import type { IndexingJob, IndexingJobPayload } from '../types';
import type { IIndexingJobService } from '../interfaces';

/**
 * Queue-ready indexing job factory.
 * BullMQ integration will enqueue via this service in a future phase.
 */
@Injectable()
export class IndexingJobService implements IIndexingJobService {
  private readonly logger = new Logger(IndexingJobService.name);

  createJob(payload: IndexingJobPayload): IndexingJob {
    return {
      id: randomUUID(),
      type: INDEXING_JOB_TYPE,
      status: INDEXING_JOB_STATUS.QUEUED,
      payload,
      createdAt: new Date(),
    };
  }

  enqueueJob(job: IndexingJob): Promise<void> {
    this.logger.debug(
      `Indexing job ${job.id} prepared for queue (BullMQ not yet integrated)`,
    );
    void job;
    return Promise.resolve();
  }
}
