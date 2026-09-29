"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
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
import {
  expertInvestigationSchema,
  type ExpertInvestigationFormValues,
} from "@/features/ewi/schemas/expert-form.schema";
import { saveExpertForm } from "@/features/ewi/storage/ewi-storage";
import { EWI_SPECIALTY_EXAMPLES } from "@/features/ewi/constants";

export function ExpertIntakeForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ExpertInvestigationFormValues>({
    resolver: zodResolver(expertInvestigationSchema),
    mode: "onBlur",
    defaultValues: {
      expertName: "",
      city: "",
      specialty: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    saveExpertForm(values);
    router.push("/ewi/investigation");
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
                Specialty claimed for this matter (suggestions available).
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Starting…" : "Start Investigation"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setValue("expertName", "Jane A. Smith, MD", {
                shouldValidate: true,
              });
              setValue("city", "Boston", { shouldValidate: true });
              setValue("specialty", "Neurology", { shouldValidate: true });
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
