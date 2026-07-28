export const ANALYSIS_PROGRESS_STEPS = [
  { id: "prepare", label: "Preparing Medical Case" },
  { id: "kb", label: "Searching Knowledge Base" },
  { id: "evidence", label: "Searching Scientific Evidence" },
  { id: "rank", label: "Ranking Medical Sources" },
  { id: "context", label: "Building Context" },
  { id: "analyze", label: "Analyzing Medical Literature" },
  { id: "reason", label: "Generating Medical Reasoning" },
  { id: "report", label: "Preparing Professional Report" },
] as const;

export const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

export const ACCIDENT_TYPE_OPTIONS = [
  { value: "motor-vehicle", label: "Motor Vehicle Collision" },
  { value: "workplace", label: "Workplace Accident" },
  { value: "slip-fall", label: "Slip and Fall" },
  { value: "sports", label: "Sports Injury" },
  { value: "assault", label: "Assault / Trauma" },
  { value: "other", label: "Other" },
] as const;
