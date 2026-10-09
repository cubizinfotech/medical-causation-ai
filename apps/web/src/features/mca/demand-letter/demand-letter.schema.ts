import { z } from "zod";

/** "$45,000.00" -> "45000.00"; "" stays "". */
export function cleanMoney(value: string): string {
  return value.replace(/[$,\s]/g, "");
}

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const MAX_AMOUNT = 10_000_000_000;

function optionalText(max: number) {
  return z.string().trim().max(max, `Use ${max} characters or fewer`);
}

function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `Use ${max} characters or fewer`);
}

function money(required: boolean, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => {
      const cleaned = cleanMoney(value);
      if (cleaned === "") return !required;
      return MONEY_PATTERN.test(cleaned) && Number(cleaned) <= MAX_AMOUNT;
    }, message);
}

export const demandLetterSchema = z.object({
  clientName: requiredText("Client name", 120),
  dateOfLoss: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))),
      "Use format YYYY-MM-DD (e.g. 2024-08-14)",
    ),
  insuredName: optionalText(120),
  claimNumber: optionalText(80),
  recipientName: optionalText(120),
  recipientCompany: optionalText(160),
  recipientAddress: optionalText(400),
  incidentDescription: requiredText("The facts of the incident", 6000),
  lostWages: money(false, "Enter an amount in dollars, like 2,400.00"),
  lostWagesNote: optionalText(600),
  futureMedical: money(false, "Enter an amount in dollars, like 12,000.00"),
  futureMedicalNote: optionalText(600),
  demandAmount: money(true, "Enter the demand in dollars, like 45,000").refine(
    (value) => cleanMoney(value) === "" || Number(cleanMoney(value)) >= 1,
    "The demand must be at least $1",
  ),
  responseDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Enter a number of days")
    .refine(
      (value) => Number(value) >= 1 && Number(value) <= 180,
      "Use 1 to 180 days",
    ),
  policyLimits: money(false, "Enter an amount in dollars, like 100,000"),
  attorneyName: requiredText("Attorney name", 120),
  firmName: optionalText(160),
  firmAddress: optionalText(400),
  attorneyPhone: optionalText(60),
  attorneyEmail: z
    .string()
    .trim()
    .max(160, "Use 160 characters or fewer")
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "Enter a valid email address",
    ),
  useAi: z.boolean(),
});

export type DemandLetterFormValues = z.infer<typeof demandLetterSchema>;

/** The body of POST /medical-analysis/histories/:id/demand-letter. */
export interface DemandLetterRequest {
  clientName: string;
  dateOfLoss?: string;
  insuredName?: string;
  claimNumber?: string;
  recipientName?: string;
  recipientCompany?: string;
  recipientAddress?: string;
  incidentDescription: string;
  lostWages?: number;
  lostWagesNote?: string;
  futureMedical?: number;
  futureMedicalNote?: string;
  demandAmount: number;
  responseDays: number;
  policyLimits?: number;
  attorneyName: string;
  firmName?: string;
  firmAddress?: string;
  attorneyPhone?: string;
  attorneyEmail?: string;
  useAi: boolean;
}

/** Empty fields are left out; amounts become numbers. */
export function toDemandLetterRequest(
  values: DemandLetterFormValues,
): DemandLetterRequest {
  const text = (value: string) => value.trim() || undefined;
  const amount = (value: string) => {
    const cleaned = cleanMoney(value);
    return cleaned ? Number(cleaned) : undefined;
  };
  return {
    clientName: values.clientName.trim(),
    dateOfLoss: text(values.dateOfLoss),
    insuredName: text(values.insuredName),
    claimNumber: text(values.claimNumber),
    recipientName: text(values.recipientName),
    recipientCompany: text(values.recipientCompany),
    recipientAddress: text(values.recipientAddress),
    incidentDescription: values.incidentDescription.trim(),
    lostWages: amount(values.lostWages),
    lostWagesNote: text(values.lostWagesNote),
    futureMedical: amount(values.futureMedical),
    futureMedicalNote: text(values.futureMedicalNote),
    demandAmount: Number(cleanMoney(values.demandAmount)),
    responseDays: Number(values.responseDays),
    policyLimits: amount(values.policyLimits),
    attorneyName: values.attorneyName.trim(),
    firmName: text(values.firmName),
    firmAddress: text(values.firmAddress),
    attorneyPhone: text(values.attorneyPhone),
    attorneyEmail: text(values.attorneyEmail),
    useAi: values.useAi,
  };
}

export const EMPTY_DEMAND_LETTER: DemandLetterFormValues = {
  clientName: "",
  dateOfLoss: "",
  insuredName: "",
  claimNumber: "",
  recipientName: "",
  recipientCompany: "",
  recipientAddress: "",
  incidentDescription: "",
  lostWages: "",
  lostWagesNote: "",
  futureMedical: "",
  futureMedicalNote: "",
  demandAmount: "",
  responseDays: "30",
  policyLimits: "",
  attorneyName: "",
  firmName: "",
  firmAddress: "",
  attorneyPhone: "",
  attorneyEmail: "",
  useAi: true,
};
