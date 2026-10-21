import { z } from "zod";
import { isValidNpi } from "@/features/ewi/utils/npi";

const NAME_PATTERN = /^[\p{L}\p{M}\d .,'’\-()/]+$/u;

function requiredTrimmed(label: string, min: number, max: number) {
  return z
    .string({ required_error: `${label} is required` })
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, `${label} is required`)
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be ${max} characters or fewer`),
    );
}

export const expertInvestigationSchema = z.object({
  expertName: requiredTrimmed("Expert name", 2, 120).refine(
    (value) => NAME_PATTERN.test(value),
    "Expert name contains invalid characters",
  ),
  /** Optional. A city narrows same-name candidates; the search runs without it. */
  city: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .refine(
      (value) => value.length === 0 || value.length >= 2,
      "City must be at least 2 characters",
    )
    .refine(
      (value) => value.length <= 80,
      "City must be 80 characters or fewer",
    )
    .refine(
      (value) => value.length === 0 || NAME_PATTERN.test(value),
      "City contains invalid characters",
    ),
  /** Any profession is accepted: a physician specialty, a trade, a licence. */
  specialty: requiredTrimmed("Specialty or profession", 2, 200).refine(
    (value) => !/^[0-9]+$/.test(value),
    "Enter a specialty or profession, not a number",
  ),
  npi: z
    .string()
    .optional()
    .transform((value) => value?.replace(/\s+/g, "") || undefined)
    .refine(
      (value) => value === undefined || /^\d{10}$/.test(value),
      "An NPI is exactly 10 digits",
    )
    .refine(
      (value) => value === undefined || isValidNpi(value),
      "This is not a valid NPI. Check the digits for a typo.",
    ),
  /** Optional free text: aliases, employers, case names, anything that helps tell people apart. */
  additionalContext: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined)
    .refine(
      (value) => value === undefined || value.length <= 2000,
      "Additional context must be 2000 characters or fewer",
    ),
  /** Set by the CV upload, not typed in. */
  cvDocumentId: z.string().uuid().optional(),
});

export type ExpertInvestigationFormValues = z.infer<
  typeof expertInvestigationSchema
>;
