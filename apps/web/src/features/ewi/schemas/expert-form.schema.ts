import { z } from "zod";

export const expertInvestigationSchema = z.object({
  expertName: z
    .string()
    .trim()
    .min(2, "Expert name is required")
    .max(200),
  specialty: z
    .string()
    .trim()
    .min(2, "Medical specialty is required")
    .max(200),
});

export type ExpertInvestigationFormValues = z.infer<
  typeof expertInvestigationSchema
>;
