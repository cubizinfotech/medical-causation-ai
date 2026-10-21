"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { PROFESSION_SPECIALTIES } from "@/features/ewi/profession-specialties";
import { NPI_REGISTRY_SEARCH_URL } from "@/features/ewi/utils/npi";
import { startRouteProgress } from "@/components/layout/route-progress";

const CONTEXT_MAX_LENGTH = 2000;

/** Red asterisk for required fields; screen readers hear "required". */
function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-destructive">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}

function OptionalMark() {
  return (
    <span className="font-normal text-muted-foreground"> (optional)</span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

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
      additionalContext: "",
    },
  });
  const contextLength = (useWatch({ control, name: "additionalContext" }) ?? "").length;

  const onSubmit = handleSubmit(async (values) => {
    setStarting(true);
    setSubmitError(null);
    const request = { ...values, ...(cv ? { cvDocumentId: cv.id } : {}) };
    saveExpertForm(request);
    clearActiveEwiJob();
    try {
      const created = await ewiClient.submitJob(request);
      saveActiveEwiJob(created);
      startRouteProgress();
      router.push("/ewi/investigation");
    } catch (error) {
      setSubmitError(
        toUserFacingError(error, "Unable to start the investigation."),
      );
      setStarting(false);
    }
  });

  return (
    <Card className="mx-auto w-full max-w-6xl">
      <CardHeader>
        <CardTitle>New Investigation</CardTitle>
        <CardDescription>
          Fields marked <span className="text-destructive">*</span> are
          required. Research starts automatically after you submit and searches
          the open web, public registries, news, reviews, and publications.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expertName">
                Expert Name
                <RequiredMark />
              </Label>
              <Input
                id="expertName"
                autoComplete="name"
                required
                aria-required="true"
                placeholder="e.g. Jane A. Smith, MD"
                aria-invalid={Boolean(errors.expertName)}
                aria-describedby={
                  errors.expertName ? "expertName-error" : "expertName-help"
                }
                {...register("expertName")}
              />
              <FieldError
                id="expertName-error"
                message={errors.expertName?.message}
              />
              {errors.expertName ? null : (
                <p
                  id="expertName-help"
                  className="text-xs text-muted-foreground"
                >
                  Full name as it appears in pleadings or the CV.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">
                Specialty / Profession
                <RequiredMark />
              </Label>
              <Controller
                control={control}
                name="specialty"
                render={({ field }) => (
                  <Combobox
                    ref={field.ref}
                    id="specialty"
                    name={field.name}
                    placeholder="e.g. Neuropsychology, Engineer, Attorney"
                    options={PROFESSION_SPECIALTIES}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-required="true"
                    aria-invalid={Boolean(errors.specialty)}
                    aria-describedby={
                      errors.specialty ? "specialty-error" : "specialty-help"
                    }
                  />
                )}
              />
              <FieldError
                id="specialty-error"
                message={errors.specialty?.message}
              />
              {errors.specialty ? null : (
                <p
                  id="specialty-help"
                  className="text-xs text-muted-foreground"
                >
                  Type any profession or specialty. Suggestions appear as you
                  type; you do not have to pick one. It is used to tell people
                  with the same name apart.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">
                City
                <OptionalMark />
              </Label>
              <Input
                id="city"
                autoComplete="address-level2"
                placeholder="e.g. Gainesville, FL"
                aria-invalid={Boolean(errors.city)}
                aria-describedby={errors.city ? "city-error" : "city-help"}
                {...register("city")}
              />
              <FieldError id="city-error" message={errors.city?.message} />
              {errors.city ? null : (
                <p id="city-help" className="text-xs text-muted-foreground">
                  Add the practice city and state when you know it. The search
                  also runs without it and lists same-name people separately.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="npi">
                NPI
                <OptionalMark />
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
              <FieldError id="npi-error" message={errors.npi?.message} />
              {errors.npi ? null : (
                <p id="npi-help" className="text-xs text-muted-foreground">
                  The expert&apos;s National Provider Identifier, for US
                  clinicians. Add it when the name is common.{" "}
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
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="additionalContext">
                Additional Context
                <OptionalMark />
              </Label>
              <span
                className="text-xs text-muted-foreground"
                aria-live="polite"
              >
                {contextLength}/{CONTEXT_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id="additionalContext"
              rows={5}
              maxLength={CONTEXT_MAX_LENGTH}
              placeholder={
                "Anything that helps identify the right person, for example:\n- other names or spellings, employer or clinic\n- a news article, case name or website to check\n- what the expert is being retained to say"
              }
              aria-invalid={Boolean(errors.additionalContext)}
              aria-describedby={
                errors.additionalContext
                  ? "additionalContext-error"
                  : "additionalContext-help"
              }
              {...register("additionalContext")}
            />
            <FieldError
              id="additionalContext-error"
              message={errors.additionalContext?.message}
            />
            {errors.additionalContext ? null : (
              <p
                id="additionalContext-help"
                className="text-xs text-muted-foreground"
              >
                Web addresses you paste here are read as additional sources.
                The text is used only to narrow identity and focus the search.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expert-cv">
              Expert&apos;s CV
              <OptionalMark />
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
          <Button
            type="submit"
            disabled={cvBusy}
            loading={starting}
            loadingText="Starting investigation…"
          >
            Start investigation
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={starting}
            onClick={() => {
              setSubmitError(null);
              reset({
                expertName: "Jane A. Smith, MD",
                city: "Boston, MA",
                specialty: "Neurology",
                npi: "",
                additionalContext: "",
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
