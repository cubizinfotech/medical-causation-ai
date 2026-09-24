import { EWI_PROGRESS_STEPS } from "./constants";

/** Display groups. Several backend stages can sit inside one row. */
export const EWI_DISPLAY_STAGES = [
  {
    id: "identify",
    label: "Identifying Expert",
    stageIds: ["identify-expert"],
  },
  {
    id: "profiles",
    label: "Researching CV and Profiles",
    stageIds: ["profiles"],
  },
  {
    id: "education",
    label: "Verifying Education",
    stageIds: ["education"],
  },
  {
    id: "licenses",
    label: "Verifying Licenses",
    stageIds: ["licenses"],
  },
  {
    id: "boards",
    label: "Verifying Certifications",
    stageIds: ["boards"],
  },
  {
    id: "publications",
    label: "Researching Publications",
    stageIds: ["publications"],
  },
  {
    id: "grants-patents",
    label: "Researching Grants and Patents",
    stageIds: ["grants", "patents", "awards"],
  },
  {
    id: "legal",
    label: "Researching Legal Information",
    stageIds: ["legal"],
  },
  {
    id: "directories",
    label: "Researching Expert Directories",
    stageIds: ["directories"],
  },
  {
    id: "websites",
    label: "Researching Websites",
    stageIds: ["websites", "ime"],
  },
  {
    id: "videos",
    label: "Researching Videos",
    stageIds: ["videos"],
  },
  {
    id: "social",
    label: "Researching Social Media",
    stageIds: ["social"],
  },
  {
    id: "news",
    label: "Researching News",
    stageIds: ["news"],
  },
  {
    id: "cross-check",
    label: "Cross-Checking Evidence",
    stageIds: ["university-rules", "cross-check"],
  },
  {
    id: "findings",
    label: "Generating Findings",
    stageIds: ["discrepancies", "summary"],
  },
  {
    id: "questions",
    label: "Generating Cross-Examination Questions",
    stageIds: ["questions"],
  },
  {
    id: "report",
    label: "Generating Final Report",
    stageIds: ["report"],
  },
] as const;

const BACKEND_STAGE_IDS = new Set<string>(
  EWI_PROGRESS_STEPS.map((step) => step.id),
);

export function displayStageIndex(step: string | null | undefined): number {
  if (!step || !BACKEND_STAGE_IDS.has(step)) return 0;
  const index = EWI_DISPLAY_STAGES.findIndex((group) =>
    (group.stageIds as readonly string[]).includes(step),
  );
  return index >= 0 ? index : 0;
}

export function displayStageLabel(step: string | null | undefined): string {
  return EWI_DISPLAY_STAGES[displayStageIndex(step)].label;
}

/** Index passed to the timeline. A completed job marks every group done. */
export function timelineIndex(
  step: string | null | undefined,
  status: string | null | undefined,
): number {
  if (status === "completed") return EWI_DISPLAY_STAGES.length;
  return displayStageIndex(step);
}
