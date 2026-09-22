/**
 * MCA frontend feature boundary.
 * Prefer these imports over legacy @/features/demo|medical-analysis|report paths.
 */
export * from "./medical-analysis";
export * from "./demo/constants";
export * from "./demo/schemas/case-form.schema";
export * from "./demo/storage/case-storage";
export * from "./demo/example-case";
export { useMedicalAnalysisJob } from "./demo/hooks/use-medical-analysis-job";
export * from "./report/report-terms";
export * from "./report/report-export";
export * from "./report/private-source-format";
