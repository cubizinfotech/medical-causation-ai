import { EWI_PROGRESS_STEPS } from "./constants";

/**
 * Attorney-facing timeline rows. Several backend stage IDs can map to one row.
 * Status is derived from live job step + source attempts — never invented.
 */
export const EWI_DISPLAY_STAGES = [
  {
    id: "identify",
    label: "Expert Identification",
    stageIds: ["identify-expert"],
  },
  {
    id: "profiles",
    label: "CV/Profile Research",
    stageIds: ["profiles"],
  },
  {
    id: "education",
    label: "Education",
    stageIds: ["education"],
  },
  {
    id: "licenses",
    label: "Licenses",
    stageIds: ["licenses"],
  },
  {
    id: "boards",
    label: "Board Certifications",
    stageIds: ["boards"],
  },
  {
    id: "publications",
    label: "Publications",
    stageIds: ["publications"],
  },
  {
    id: "grants",
    label: "Grants",
    stageIds: ["grants"],
  },
  {
    id: "patents",
    label: "Patents",
    stageIds: ["patents"],
  },
  {
    id: "awards",
    label: "Awards",
    stageIds: ["awards", "memberships"],
  },
  {
    id: "legal",
    label: "Legal Research",
    stageIds: ["legal"],
  },
  {
    id: "orders",
    label: "Orders",
    stageIds: ["legal"],
    sourceCategories: ["court_order", "order"],
  },
  {
    id: "motions",
    label: "Motions",
    stageIds: ["legal"],
    sourceCategories: ["motion", "pleading"],
  },
  {
    id: "depositions",
    label: "Depositions",
    stageIds: ["legal"],
    sourceCategories: ["deposition", "testimony"],
  },
  {
    id: "directories",
    label: "Expert Directories",
    stageIds: ["directories"],
  },
  {
    id: "websites",
    label: "Websites",
    stageIds: ["websites", "ime"],
  },
  {
    id: "videos",
    label: "Videos",
    stageIds: ["videos"],
  },
  {
    id: "social",
    label: "Social Media",
    stageIds: ["social"],
  },
  {
    id: "news",
    label: "News",
    stageIds: ["news"],
  },
  {
    id: "university",
    label: "University Research",
    stageIds: ["university-rules"],
  },
  {
    id: "income",
    label: "Income/Bias",
    stageIds: ["public-records", "analyze-financial"],
  },
  {
    id: "cross-check",
    label: "Cross-Checking",
    stageIds: ["cross-check", "analyze-legal", "analyze-presence"],
  },
  {
    id: "inconsistencies",
    label: "Inconsistency Analysis",
    stageIds: ["discrepancies", "summary"],
  },
  {
    id: "questions",
    label: "Cross-Examination Questions",
    stageIds: ["questions"],
  },
  {
    id: "report",
    label: "Report Generation",
    stageIds: ["report"],
  },
] as const;

export type EwiDisplayStage = (typeof EWI_DISPLAY_STAGES)[number];

export type EwiStageUiStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "unavailable"
  | "restricted";

const BACKEND_STAGE_IDS = new Set<string>(
  EWI_PROGRESS_STEPS.map((step) => step.id),
);

const STAGE_ORDER = EWI_PROGRESS_STEPS.map((step) => step.id);

export function displayStageIndex(step: string | null | undefined): number {
  if (!step || !BACKEND_STAGE_IDS.has(step)) return 0;
  const index = EWI_DISPLAY_STAGES.findIndex((group) =>
    (group.stageIds as readonly string[]).includes(step),
  );
  return index >= 0 ? index : 0;
}

export function displayStageLabel(step: string | null | undefined): string {
  return EWI_DISPLAY_STAGES[displayStageIndex(step)]?.label ?? "Investigation";
}

/** Index for simple timelines. Completed jobs mark through the last reported step. */
export function timelineIndex(
  step: string | null | undefined,
  status: string | null | undefined,
): number {
  const reached = displayStageIndex(step);
  if (status === "completed") {
    return Math.min(reached + 1, EWI_DISPLAY_STAGES.length);
  }
  return reached;
}

function backendStepRank(step: string | null | undefined): number {
  if (!step) return -1;
  const index = STAGE_ORDER.indexOf(step as (typeof STAGE_ORDER)[number]);
  return index;
}

/**
 * Derive per-stage UI status from the live job step and optional source attempts.
 * Does not invent completed stages ahead of the backend cursor.
 */
export function resolveStageStatuses(input: {
  currentStep: string | null | undefined;
  jobStatus: string | null | undefined;
  sourceStatuses?: Array<{
    status: string;
    attemptStatus?: string;
    disposition?: string;
    checked?: boolean;
    itemCount?: number;
  }>;
}): EwiStageUiStatus[] {
  const currentRank = backendStepRank(input.currentStep);
  const jobFailed =
    input.jobStatus === "failed" || input.jobStatus === "cancelled";
  const jobCompleted = input.jobStatus === "completed";

  const hasUnavailable = (input.sourceStatuses ?? []).some(
    (source) =>
      source.attemptStatus === "unavailable" ||
      source.status === "unavailable" ||
      source.disposition === "unavailable",
  );
  const hasRestricted = (input.sourceStatuses ?? []).some(
    (source) =>
      source.attemptStatus === "restricted" ||
      source.disposition === "paid_access",
  );
  const hasFailedSource = (input.sourceStatuses ?? []).some(
    (source) =>
      source.attemptStatus === "failed" || source.status === "error",
  );

  return EWI_DISPLAY_STAGES.map((stage) => {
    const stageRanks = stage.stageIds.map((id) => backendStepRank(id));
    const minRank = Math.min(...stageRanks);
    const maxRank = Math.max(...stageRanks);

    if (jobCompleted) {
      if (hasRestricted && stage.id === "legal") return "restricted";
      if (hasUnavailable && ["legal", "directories", "social"].includes(stage.id)) {
        return "unavailable";
      }
      return "completed";
    }

    if (jobFailed && currentRank >= minRank && currentRank <= maxRank) {
      return "failed";
    }

    if (currentRank < 0) return "pending";

    if (maxRank < currentRank) {
      if (hasFailedSource && stage.id === "legal") return "failed";
      if (hasRestricted && stage.id === "legal") return "restricted";
      if (hasUnavailable && stage.id === "legal") return "unavailable";
      return "completed";
    }

    if (minRank <= currentRank && currentRank <= maxRank) {
      return jobFailed ? "failed" : "running";
    }

    return "pending";
  });
}
