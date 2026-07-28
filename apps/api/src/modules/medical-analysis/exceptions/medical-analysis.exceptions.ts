export class MedicalAnalysisException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AnalysisSafetyException extends MedicalAnalysisException {
  constructor(message: string) {
    super(message, 'ANALYSIS_SAFETY_VIOLATION');
  }
}

export class InsufficientEvidenceException extends MedicalAnalysisException {
  constructor(message: string) {
    super(message, 'INSUFFICIENT_EVIDENCE');
  }
}
