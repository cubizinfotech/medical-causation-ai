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
  city: requiredTrimmed("City", 2, 80).refine(
    (value) => NAME_PATTERN.test(value),
    "City contains invalid characters",
  ),
  specialty: requiredTrimmed("Medical specialty", 2, 100).refine(
    (value) => !/^[0-9]+$/.test(value),
    "Enter a medical specialty, not a number",
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
});

export type ExpertInvestigationFormValues = z.infer<
  typeof expertInvestigationSchema
>;
