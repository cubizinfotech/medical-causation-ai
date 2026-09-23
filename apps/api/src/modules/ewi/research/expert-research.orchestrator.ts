import { Injectable, Logger } from '@nestjs/common';
import {
  ExpertResearchService,
  type ExpertEvidenceItem,
  type ExpertResearchQuery,
  type ExpertResearchSourceResult,
} from '@integrations/expert-research';
import {
  DiscrepancyAnalyzer,
  type ExpertDiscrepancy,
} from './discrepancy-analyzer';

export interface ExpertResearchBundle {
  query: ExpertResearchQuery;
  sourceResults: ExpertResearchSourceResult[];
  evidence: ExpertEvidenceItem[];
  discrepancies: ExpertDiscrepancy[];
}

@Injectable()
export class ExpertResearchOrchestrator {
  private readonly logger = new Logger(ExpertResearchOrchestrator.name);
  private readonly discrepancyAnalyzer = new DiscrepancyAnalyzer();

  constructor(private readonly research: ExpertResearchService) {}

  async investigate(query: ExpertResearchQuery): Promise<ExpertResearchBundle> {
    this.logger.log(
      `Collecting expert research for ${query.expertName} (${query.specialty})`,
    );
    const sourceResults = await this.research.collect(query);
    const evidence = sourceResults.flatMap((r) => r.items);
    const discrepancies = this.discrepancyAnalyzer.analyze(evidence);

    return { query, sourceResults, evidence, discrepancies };
  }
}
