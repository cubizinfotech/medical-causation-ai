import { z } from "zod";

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
});

export type ExpertInvestigationFormValues = z.infer<
  typeof expertInvestigationSchema
>;
