"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    defaultValues: {
      expertName: "",
      specialty: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    saveExpertForm(values);
    router.push("/ewi/investigation");
  });

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="expertName">Expert Name</Label>
        <Input
          id="expertName"
          placeholder="e.g. Jane A. Smith, MD"
          {...register("expertName")}
        />
        {errors.expertName && (
          <p className="text-sm text-destructive">{errors.expertName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="specialty">Medical Specialty</Label>
        <Input
          id="specialty"
          placeholder="e.g. Neurology"
          list="ewi-specialty-examples"
          {...register("specialty")}
        />
        <datalist id="ewi-specialty-examples">
          {EWI_SPECIALTY_EXAMPLES.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        {errors.specialty && (
          <p className="text-sm text-destructive">{errors.specialty.message}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setValue("expertName", "Jane A. Smith, MD");
            setValue("specialty", "Neurology");
          }}
        >
          Load Example
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          Start Investigation
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/")}>
          Back
        </Button>
      </div>
    </form>
  );
}
