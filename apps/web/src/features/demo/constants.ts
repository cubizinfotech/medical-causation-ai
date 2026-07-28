export const ANALYSIS_PROGRESS_STEPS = [
  { id: "intake", label: "Medical Case Intake" },
  { id: "research", label: "AI Research" },
  { id: "private-kb", label: "Searching Private Knowledge Base" },
  { id: "public-lit", label: "Searching Public Medical Literature" },
  { id: "evidence", label: "Evidence Analysis" },
  { id: "reasoning", label: "Medical Reasoning" },
  { id: "summary", label: "Generating Statistical Summary" },
  { id: "cross-exam", label: "Generating Cross Examination Questions" },
  { id: "report", label: "Final Report" },
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

export const LANDING_CAPABILITIES = [
  {
    title: "AI-Powered Medical Causation Analysis",
    description:
      "Structured causation opinions grounded in retrieved medical literature and case-specific evidence.",
  },
  {
    title: "Public + Private Medical Research",
    description:
      "Hybrid search across your firm's knowledge base and leading public biomedical databases.",
  },
  {
    title: "Evidence-Based Legal Reports",
    description:
      "Attorney-ready reports with supporting and opposing evidence, confidence scoring, and citations.",
  },
  {
    title: "AI-Generated Cross Examination Questions",
    description:
      "50 leading deposition questions organized by category to challenge opposing medical experts.",
  },
] as const;

export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: "Enter Case Details",
    description: "Submit patient, accident, and medical information through secure intake.",
  },
  {
    step: 2,
    title: "AI Research Engine",
    description:
      "The system searches private knowledge bases and public medical literature simultaneously.",
  },
  {
    step: 3,
    title: "Evidence Analysis",
    description:
      "AI classifies supporting and opposing evidence with citation-backed reasoning.",
  },
  {
    step: 4,
    title: "Professional Report",
    description:
      "Receive an executive summary, causation opinion, references, and cross-examination questions.",
  },
] as const;
