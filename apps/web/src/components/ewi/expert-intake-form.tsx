"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ewiClient } from "@/features/ewi/ewi.service";
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

export function ExpertIntakeForm() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
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
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setStarting(true);
    setSubmitError(null);
    saveExpertForm(values);
    clearActiveEwiJob();
    try {
      const created = await ewiClient.submitJob(values);
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
            <Input
              id="specialty"
              placeholder="e.g. Neurology"
              list="ewi-specialty-examples"
              aria-invalid={Boolean(errors.specialty)}
              aria-describedby={
                errors.specialty ? "specialty-error" : undefined
              }
              {...register("specialty")}
            />
            <datalist id="ewi-specialty-examples">
              {EWI_SPECIALTY_EXAMPLES.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
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
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {submitError ? (
            <p className="w-full text-sm text-destructive" role="alert">
              {submitError}
            </p>
          ) : null}
          <Button type="submit" disabled={starting}>
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
