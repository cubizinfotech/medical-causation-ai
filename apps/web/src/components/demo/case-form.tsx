"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  Car,
  FileText,
  HelpCircle,
  Sparkles,
  Stethoscope,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/demo/date-input";
import { FormField } from "@/components/demo/form-field";
import { FileUploader } from "@/components/demo/file-uploader";
import {
  ACCIDENT_TYPE_OPTIONS,
  GENDER_OPTIONS,
} from "@/features/demo/constants";
import {
  demoCaseExamples,
  getDemoCaseExample,
} from "@/features/demo/example-case";
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

interface CaseFormProps {
  initialValues?: Partial<CaseFormValues>;
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 pt-6">{children}</CardContent>
    </Card>
  );
}

export function CaseForm({ initialValues }: CaseFormProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [loadedExample, setLoadedExample] = useState<{
    title: string;
    summary: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: { ...caseFormDefaults, ...initialValues },
  });

  const loadExampleCase = () => {
    setSubmitError(null);
    const example = getDemoCaseExample(exampleIndex);
    reset(example.values);
    setLoadedExample({ title: example.title, summary: example.summary });
    setExampleIndex((current) => current + 1);
  };

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Need sample data for testing?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Click <strong>Load Example Case</strong> to cycle through{" "}
              {demoCaseExamples.length} realistic scenarios (mTBI/stroke, cervical
              MVA, workplace fall). Or copy from{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                docs/demo-case-example.md
              </code>
            </p>
            {loadedExample ? (
              <p className="mt-2 text-sm text-primary">
                Loaded: <span className="font-medium">{loadedExample.title}</span>
                {" — "}
                {loadedExample.summary}
              </p>
            ) : null}
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={loadExampleCase}>
          Load Example Case
          <Badge variant="outline" className="ml-2 border-primary/30 bg-background/80">
            {demoCaseExamples.length} samples
          </Badge>
        </Button>
      </div>

      <FormSection
        icon={User}
        title="Patient Information"
        description="Basic demographics for the injured party."
      >
        <div className="grid gap-6 sm:grid-cols-3">
          <FormField
            id="patientName"
            label="Full Name"
            required
            error={errors.patientName?.message}
          >
            <Input
              id="patientName"
              placeholder="Robert Chen"
              {...register("patientName")}
            />
          </FormField>
          <FormField
            id="patientAge"
            label="Age"
            required
            error={errors.patientAge?.message}
          >
            <Input id="patientAge" placeholder="52" {...register("patientAge")} />
          </FormField>
          <FormField
            id="patientGender"
            label="Gender"
            required
            error={errors.patientGender?.message}
          >
            <Select id="patientGender" {...register("patientGender")}>
              <option value="" disabled>
                Select gender
              </option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        icon={Car}
        title="Accident Information"
        description="How and when the incident occurred."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            id="accidentDate"
            label="Accident Date"
            required
            hint="Enter as YYYY-MM-DD"
            error={errors.accidentDate?.message}
          >
            <DateInput id="accidentDate" {...register("accidentDate")} />
          </FormField>
          <FormField
            id="accidentType"
            label="Accident Type"
            required
            error={errors.accidentType?.message}
          >
            <Select id="accidentType" {...register("accidentType")}>
              <option value="" disabled>
                Select type
              </option>
              {ACCIDENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.label}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField
          id="accidentDescription"
          label="Accident Description"
          required
          hint="Mechanism of injury, immediate symptoms, and scene details."
          error={errors.accidentDescription?.message}
        >
          <Textarea
            id="accidentDescription"
            className="min-h-[140px]"
            placeholder="Describe how the accident occurred, mechanism of injury, and immediate aftermath..."
            {...register("accidentDescription")}
          />
        </FormField>
      </FormSection>

      <FormSection
        icon={Stethoscope}
        title="Medical Information"
        description="Diagnosis, symptoms, history, and clinical timeline."
      >
        <FormField
          id="diagnosis"
          label="Diagnosis"
          required
          hint="Primary and secondary diagnoses relevant to causation."
          error={errors.diagnosis?.message}
        >
          <Textarea
            id="diagnosis"
            className="min-h-[100px]"
            placeholder="e.g. Acute ischemic stroke; mild traumatic brain injury..."
            {...register("diagnosis")}
          />
        </FormField>
        <FormField
          id="symptoms"
          label="Symptoms"
          required
          error={errors.symptoms?.message}
        >
          <Textarea
            id="symptoms"
            className="min-h-[140px]"
            placeholder="Current and post-accident symptoms..."
            {...register("symptoms")}
          />
        </FormField>
        <div className="grid gap-6 lg:grid-cols-2">
          <FormField id="medicalHistory" label="Prior Medical History">
            <Textarea
              id="medicalHistory"
              className="min-h-[120px]"
              placeholder="Relevant comorbidities, prior injuries, surgical history..."
              {...register("medicalHistory")}
            />
          </FormField>
          <FormField id="medications" label="Current Medications">
            <Textarea
              id="medications"
              className="min-h-[120px]"
              placeholder="List medications and dosages..."
              {...register("medications")}
            />
          </FormField>
        </div>
        <FormField
          id="timeline"
          label="Clinical Timeline"
          hint="Key dates from accident through diagnosis and treatment."
        >
          <Textarea
            id="timeline"
            className="min-h-[120px]"
            placeholder="YYYY-MM-DD — Event description..."
            {...register("timeline")}
          />
        </FormField>
      </FormSection>

      <FormSection
        icon={HelpCircle}
        title="Medical Causation Question"
        description="The specific question the AI will analyze using retrieved evidence."
      >
        <FormField
          id="medicalQuestion"
          label="Question for AI Analysis"
          required
          error={errors.medicalQuestion?.message}
        >
          <Textarea
            id="medicalQuestion"
            className="min-h-[140px]"
            placeholder="e.g. Did the mild traumatic brain injury materially contribute to the subsequent ischemic stroke?"
            {...register("medicalQuestion")}
          />
        </FormField>
      </FormSection>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Supporting Documents</CardTitle>
              <CardDescription className="mt-1">
                Optional uploads for demonstration — files are not sent to the
                API in this phase.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <FileUploader files={files} onChange={setFiles} />
        </CardContent>
      </Card>

      {submitError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Required</Badge>
            <span>Fields marked with * must be completed before analysis.</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => router.push("/")}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Run AI Analysis"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
