"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/layout";
import { FileUploader } from "@/components/demo";
import {
  ACCIDENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
} from "@/features/demo/constants";
import {
  caseFormDefaults,
  caseFormSchema,
  type CaseFormValues,
} from "@/features/demo/schemas/case-form.schema";
import {
  saveCaseForm,
  saveUploadedFileNames,
  clearAnalysisResult,
} from "@/features/demo/storage/case-storage";
import { cn } from "@/utils/cn";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-destructive">{message}</p>;
}

interface CaseFormProps {
  initialValues?: Partial<CaseFormValues>;
}

export function CaseForm({ initialValues }: CaseFormProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: { ...caseFormDefaults, ...initialValues },
  });

  const onSubmit = (values: CaseFormValues) => {
    setSubmitError(null);
    try {
      clearAnalysisResult();
      saveCaseForm(values);
      saveUploadedFileNames(files.map((f) => f.name));
      router.push("/analysis");
    } catch {
      setSubmitError("Unable to save case data. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label htmlFor="patientName">Name</Label>
            <Input id="patientName" placeholder="Jane Doe" {...register("patientName")} />
            <FieldError message={errors.patientName?.message} />
          </div>
          <div>
            <Label htmlFor="patientAge">Age</Label>
            <Input id="patientAge" placeholder="45" {...register("patientAge")} />
            <FieldError message={errors.patientAge?.message} />
          </div>
          <div>
            <Label htmlFor="patientGender">Gender</Label>
            <select
              id="patientGender"
              className={cn(
                "flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              {...register("patientGender")}
              defaultValue=""
            >
              <option value="" disabled>
                Select gender
              </option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FieldError message={errors.patientGender?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accident Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="accidentDate">Accident Date</Label>
              <Input id="accidentDate" type="date" {...register("accidentDate")} />
              <FieldError message={errors.accidentDate?.message} />
            </div>
            <div>
              <Label htmlFor="accidentType">Accident Type</Label>
              <select
                id="accidentType"
                className="flex h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("accidentType")}
                defaultValue=""
              >
                <option value="" disabled>
                  Select type
                </option>
                {ACCIDENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.label}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.accidentType?.message} />
            </div>
          </div>
          <div>
            <Label htmlFor="accidentDescription">Accident Description</Label>
            <Textarea
              id="accidentDescription"
              placeholder="Describe how the accident occurred, mechanism of injury, and immediate aftermath..."
              {...register("accidentDescription")}
            />
            <FieldError message={errors.accidentDescription?.message} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medical Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div>
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Input id="diagnosis" placeholder="e.g. Ischemic stroke" {...register("diagnosis")} />
            <FieldError message={errors.diagnosis?.message} />
          </div>
          <div>
            <Label htmlFor="symptoms">Symptoms</Label>
            <Textarea
              id="symptoms"
              placeholder="Current and post-accident symptoms..."
              {...register("symptoms")}
            />
            <FieldError message={errors.symptoms?.message} />
          </div>
          <div>
            <Label htmlFor="medicalHistory">Prior Medical History</Label>
            <Textarea id="medicalHistory" {...register("medicalHistory")} />
          </div>
          <div>
            <Label htmlFor="medications">Current Medications</Label>
            <Textarea id="medications" {...register("medications")} />
          </div>
          <div>
            <Label htmlFor="timeline">Timeline</Label>
            <Textarea
              id="timeline"
              placeholder="Key dates: accident, symptom onset, diagnosis, treatment..."
              {...register("timeline")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medical Question</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="medicalQuestion">
            What medical causation question should AI answer?
          </Label>
          <Textarea
            id="medicalQuestion"
            className="mt-2 min-h-[140px]"
            placeholder="e.g. Can mild traumatic brain injury increase the risk of stroke?"
            {...register("medicalQuestion")}
          />
          <FieldError message={errors.medicalQuestion?.message} />
        </CardContent>
      </Card>

      <SectionHeader
        title="Supporting Documents"
        description="Optional uploads for demonstration — files are not sent to the server in this phase."
      />
      <FileUploader files={files} onChange={setFiles} />

      {submitError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/")}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Run AI Analysis"}
        </Button>
      </div>
    </form>
  );
}
