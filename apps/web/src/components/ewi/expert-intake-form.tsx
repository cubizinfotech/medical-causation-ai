"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExpertCvUpload } from "@/components/ewi/expert-cv-upload";
import { ewiClient } from "@/features/ewi/ewi.service";
import type { EwiExpertDocumentSummary } from "@/features/ewi/types";
import {
  expertInvestigationSchema,
  type ExpertInvestigationFormValues,
} from "@/features/ewi/schemas/expert-form.schema";
import {
  clearActiveEwiJob,
  saveActiveEwiJob,
  saveExpertForm,
} from "@/features/ewi/storage/ewi-storage";
import { toUserFacingError } from "@/features/ewi/utils/user-facing-error";
import { EWI_SPECIALTY_EXAMPLES } from "@/features/ewi/constants";
import { NPI_REGISTRY_SEARCH_URL } from "@/features/ewi/utils/npi";

export function ExpertIntakeForm() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cv, setCv] = useState<EwiExpertDocumentSummary | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpertInvestigationFormValues>({
    resolver: zodResolver(expertInvestigationSchema),
    mode: "onBlur",
    defaultValues: {
      expertName: "",
      city: "",
      specialty: "",
      npi: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setStarting(true);
    setSubmitError(null);
    const request = { ...values, ...(cv ? { cvDocumentId: cv.id } : {}) };
    saveExpertForm(request);
    clearActiveEwiJob();
    try {
      const created = await ewiClient.submitJob(request);
      saveActiveEwiJob(created);
      router.push("/ewi/investigation");
    } catch (error) {
      setSubmitError(
        toUserFacingError(error, "Unable to start the investigation."),
      );
      setStarting(false);
    }
  });

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>New Investigation</CardTitle>
        <CardDescription>
          Enter the opposing expert&apos;s identifying details. Research starts
          automatically after you submit.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="expertName">Expert Name</Label>
            <Input
              id="expertName"
              autoComplete="name"
              placeholder="e.g. Jane A. Smith, MD"
              aria-invalid={Boolean(errors.expertName)}
              aria-describedby={
                errors.expertName ? "expertName-error" : undefined
              }
              {...register("expertName")}
            />
            {errors.expertName ? (
              <p
                id="expertName-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.expertName.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Full name as it appears in pleadings or the CV.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              autoComplete="address-level2"
              placeholder="e.g. Boston"
              aria-invalid={Boolean(errors.city)}
              aria-describedby={errors.city ? "city-error" : undefined}
              {...register("city")}
            />
            {errors.city ? (
              <p id="city-error" className="text-sm text-destructive" role="alert">
                {errors.city.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Primary practice city used to disambiguate common names.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialty">Medical Specialty</Label>
            <Controller
              control={control}
              name="specialty"
              render={({ field }) => (
                <Combobox
                  ref={field.ref}
                  id="specialty"
                  name={field.name}
                  placeholder="e.g. Neurology"
                  options={EWI_SPECIALTY_EXAMPLES}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={Boolean(errors.specialty)}
                  aria-describedby={
                    errors.specialty ? "specialty-error" : undefined
                  }
                />
              )}
            />
            {errors.specialty ? (
              <p
                id="specialty-error"
                className="text-sm text-destructive"
                role="alert"
              >
                {errors.specialty.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Choose a suggestion or type any other specialty.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="npi">
              NPI{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="npi"
              inputMode="numeric"
              autoComplete="off"
              maxLength={14}
              placeholder="10 digits, e.g. 1234567893"
              aria-invalid={Boolean(errors.npi)}
              aria-describedby={errors.npi ? "npi-error" : "npi-help"}
              {...register("npi")}
            />
            {errors.npi ? (
              <p id="npi-error" className="text-sm text-destructive" role="alert">
                {errors.npi.message}
              </p>
            ) : (
              <p id="npi-help" className="text-xs text-muted-foreground">
                The expert&apos;s National Provider Identifier. Add it when the
                name is common or the expert may practice in a nearby city;
                payments and records are then tied to this one clinician.{" "}
                <a
                  href={NPI_REGISTRY_SEARCH_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Look up an NPI
                </a>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expert-cv">
              Expert&apos;s CV{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <ExpertCvUpload
              inputId="expert-cv"
              value={cv}
              onChange={setCv}
              onBusyChange={setCvBusy}
              disabled={starting}
            />
            <p className="text-xs text-muted-foreground">
              PDF. The investigation reads what the CV claims (specialty,
              licenses, boards, publications, industry ties, expert work) and
              checks each claim against the NPI Registry, OpenAlex, Open
              Payments, and court opinions, citing the CV page. Only you can
              open the CV; its text is sent to the AI provider configured for
              this site.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {submitError ? (
            <p className="w-full text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          <Button type="submit" disabled={starting || cvBusy}>
            {starting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {starting ? "Starting investigation…" : "Start investigation"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={starting}
            onClick={() => {
              setSubmitError(null);
              reset({
                expertName: "Jane A. Smith, MD",
                city: "Boston",
                specialty: "Neurology",
                npi: "",
              });
            }}
          >
            Load Example
          </Button>
          <Button asChild variant="ghost">
            <Link href="/ewi">Back to Dashboard</Link>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
