import { z } from "zod";

export const caseFormSchema = z.object({
  patientName: z.string().min(2, "Patient name is required"),
  patientAge: z
    .string()
    .min(1, "Age is required")
    .regex(/^\d{1,3}$/, "Enter a valid age"),
  patientGender: z.string().min(1, "Gender is required"),
  accidentDate: z.string().min(1, "Accident date is required"),
  accidentType: z.string().min(2, "Accident type is required"),
  accidentDescription: z
    .string()
    .min(10, "Please provide at least 10 characters describing the accident"),
  diagnosis: z.string().min(2, "Diagnosis is required"),
  symptoms: z.string().min(5, "Please describe symptoms"),
  medicalHistory: z.string().optional(),
  medications: z.string().optional(),
  timeline: z.string().optional(),
  medicalQuestion: z
    .string()
    .min(10, "Please enter a medical causation question (min 10 characters)"),
});

export type CaseFormValues = z.infer<typeof caseFormSchema>;

export const caseFormDefaults: CaseFormValues = {
  patientName: "",
  patientAge: "",
  patientGender: "",
  accidentDate: "",
  accidentType: "",
  accidentDescription: "",
  diagnosis: "",
  symptoms: "",
  medicalHistory: "",
  medications: "",
  timeline: "",
  medicalQuestion: "",
};
