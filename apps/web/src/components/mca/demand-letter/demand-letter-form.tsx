"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  FileDown,
  Info,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/mca/demo/form-field";
import type { MedicalSpecials } from "@/features/mca/medical-analysis/types";
import {
  demandLetterSchema,
  toDemandLetterRequest,
  type DemandLetterFormValues,
} from "@/features/mca/demand-letter/demand-letter.schema";
import { downloadDemandLetter } from "@/features/mca/demand-letter/demand-letter.service";
import {
  saveDraft,
  saveSender,
} from "@/features/mca/demand-letter/demand-letter.storage";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type Status =
  | { kind: "idle" }
  | { kind: "drafting" }
  | { kind: "done"; fileName: string }
  | { kind: "error"; message: string };

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

/** What the letter will say about the bills, from the report. */
function BillsSummary({ specials }: { specials?: MedicalSpecials }) {
  const billed = specials?.providers.filter((p) => p.billed > 0) ?? [];
  const pending = specials?.unbilledProviders.map((p) => p.provider) ?? [];
  return (
    <div className="space-y-1.5 rounded-lg bg-muted/50 px-3 py-2.5 text-sm sm:col-span-2">
      {billed.length > 0 && specials ? (
        <p>
          Medical bills read from the records:{" "}
          <span className="font-semibold tabular-nums">
            {money.format(specials.totalBilled)}
          </span>{" "}
          from {billed.length} {billed.length === 1 ? "provider" : "providers"}.
          The letter itemizes them by provider.
        </p>
      ) : (
        <p>
          No bills were read from the uploaded records. The letter will say
          that itemized bills follow under separate cover.
        </p>
      )}
      {pending.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          No bill was found for {pending.join(", ")}. The letter says these
          bills have been requested.
        </p>
      ) : null}
    </div>
  );
}

export function DemandLetterForm({
  caseId,
  defaults,
  specials,
  hasChronology,
  highDefenseIssues,
}: {
  caseId: string;
  defaults: DemandLetterFormValues;
  specials?: MedicalSpecials;
  hasChronology: boolean;
  highDefenseIssues: number;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DemandLetterFormValues>({
    resolver: zodResolver(demandLetterSchema),
    mode: "onBlur",
    defaultValues: defaults,
  });

  const a11y = (name: keyof DemandLetterFormValues) => ({
    id: name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus({ kind: "drafting" });
    saveSender(values);
    saveDraft(caseId, values);
    try {
      const fileName = await downloadDemandLetter(
        caseId,
        toDemandLetterRequest(values),
      );
      setStatus({ kind: "done", fileName });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "The letter could not be drafted.",
      });
    }
  });

  const drafting = status.kind === "drafting";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Section title="Client and claim">
        <FormField id="clientName" label="Client name" required error={errors.clientName?.message}>
          <Input autoComplete="off" {...a11y("clientName")} {...register("clientName")} />
        </FormField>
        <FormField
          id="dateOfLoss"
          label="Date of loss"
          error={errors.dateOfLoss?.message}
          hint="From the case; change it if needed."
        >
          <Controller
            control={control}
            name="dateOfLoss"
            render={({ field }) => (
              <DatePicker
                ref={field.ref}
                name={field.name}
                disableFuture
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                {...a11y("dateOfLoss")}
              />
            )}
          />
        </FormField>
        <FormField id="insuredName" label="Insured (at-fault party)" error={errors.insuredName?.message}>
          <Input autoComplete="off" {...a11y("insuredName")} {...register("insuredName")} />
        </FormField>
        <FormField id="claimNumber" label="Claim number" error={errors.claimNumber?.message}>
          <Input autoComplete="off" {...a11y("claimNumber")} {...register("claimNumber")} />
        </FormField>
      </Section>

      <Section title="Recipient" description="The claims representative and insurer.">
        <FormField id="recipientName" label="Claims representative" error={errors.recipientName?.message}>
          <Input autoComplete="off" {...a11y("recipientName")} {...register("recipientName")} />
        </FormField>
        <FormField id="recipientCompany" label="Insurance company" error={errors.recipientCompany?.message}>
          <Input autoComplete="off" {...a11y("recipientCompany")} {...register("recipientCompany")} />
        </FormField>
        <FormField
          id="recipientAddress"
          label="Address"
          className="sm:col-span-2"
          error={errors.recipientAddress?.message}
        >
          <Textarea rows={3} {...a11y("recipientAddress")} {...register("recipientAddress")} />
        </FormField>
      </Section>

      <Section title="Facts of the incident">
        <FormField
          id="incidentDescription"
          label="How it happened and why the insured is responsible"
          required
          className="sm:col-span-2"
          error={errors.incidentDescription?.message}
          hint="Starts from the case's accident description. Separate paragraphs with a blank line. This text goes into the letter as written."
        >
          <Textarea
            rows={8}
            {...a11y("incidentDescription")}
            {...register("incidentDescription")}
          />
        </FormField>
        {highDefenseIssues > 0 ? (
          <p className="flex gap-2 text-xs text-amber-700 sm:col-span-2 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            The report lists {highDefenseIssues} high-priority defense{" "}
            {highDefenseIssues === 1 ? "issue" : "issues"}, such as a delay or
            gap in treatment. Consider addressing them in the facts.
          </p>
        ) : null}
      </Section>

      <Section title="Damages">
        <BillsSummary specials={specials} />
        <FormField id="lostWages" label="Lost wages ($)" error={errors.lostWages?.message}>
          <Input inputMode="decimal" placeholder="e.g. 2,400.00" {...a11y("lostWages")} {...register("lostWages")} />
        </FormField>
        <FormField id="lostWagesNote" label="Lost wages basis" error={errors.lostWagesNote?.message}>
          <Input placeholder="e.g. Three weeks off work at $800 per week" {...a11y("lostWagesNote")} {...register("lostWagesNote")} />
        </FormField>
        <FormField id="futureMedical" label="Future medical care ($)" error={errors.futureMedical?.message}>
          <Input inputMode="decimal" placeholder="e.g. 12,000.00" {...a11y("futureMedical")} {...register("futureMedical")} />
        </FormField>
        <FormField id="futureMedicalNote" label="Future care basis" error={errors.futureMedicalNote?.message}>
          <Input placeholder="e.g. Treating physician's estimate dated ..." {...a11y("futureMedicalNote")} {...register("futureMedicalNote")} />
        </FormField>
      </Section>

      <Section title="Demand">
        <FormField id="demandAmount" label="Demand amount ($)" required error={errors.demandAmount?.message}>
          <Input inputMode="decimal" placeholder="e.g. 45,000" {...a11y("demandAmount")} {...register("demandAmount")} />
        </FormField>
        <FormField id="responseDays" label="Days to respond" required error={errors.responseDays?.message}>
          <Input inputMode="numeric" {...a11y("responseDays")} {...register("responseDays")} />
        </FormField>
        <FormField
          id="policyLimits"
          label="Policy limits ($)"
          error={errors.policyLimits?.message}
          hint="Optional. Stated in the letter only if entered."
        >
          <Input inputMode="decimal" {...a11y("policyLimits")} {...register("policyLimits")} />
        </FormField>
      </Section>

      <Section title="Signature" description="Remembered in this browser for your next letter.">
        <FormField id="attorneyName" label="Attorney name" required error={errors.attorneyName?.message}>
          <Input autoComplete="name" {...a11y("attorneyName")} {...register("attorneyName")} />
        </FormField>
        <FormField id="firmName" label="Firm" error={errors.firmName?.message}>
          <Input autoComplete="organization" {...a11y("firmName")} {...register("firmName")} />
        </FormField>
        <FormField
          id="firmAddress"
          label="Firm address"
          className="sm:col-span-2"
          error={errors.firmAddress?.message}
        >
          <Textarea rows={2} {...a11y("firmAddress")} {...register("firmAddress")} />
        </FormField>
        <FormField id="attorneyPhone" label="Phone" error={errors.attorneyPhone?.message}>
          <Input autoComplete="tel" {...a11y("attorneyPhone")} {...register("attorneyPhone")} />
        </FormField>
        <FormField id="attorneyEmail" label="Email" error={errors.attorneyEmail?.message}>
          <Input type="email" autoComplete="email" {...a11y("attorneyEmail")} {...register("attorneyEmail")} />
        </FormField>
      </Section>

      <Card>
        <CardContent className="space-y-4 p-6">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              disabled={!hasChronology}
              {...register("useAi")}
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                Write the Injuries and Treatment section with AI
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {hasChronology
                  ? "Drafted from the cited chronology. Every sentence must cite a record page, and dates and codes must match the records; otherwise the chronology entries are listed instead."
                  : "Available when medical records were uploaded with the case."}
              </span>
            </span>
          </label>

          <p className="flex gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            The letter is a Word draft marked DRAFT. Check every statement
            against the records before sending. Time-limited and policy-limits
            demands have rules that vary by state.
          </p>

          {status.kind === "done" ? (
            <p className="flex gap-2 text-sm text-primary" role="status">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Downloaded {status.fileName}. Open it in Word to review and edit.
            </p>
          ) : null}
          {status.kind === "error" ? (
            <p className="flex gap-2 text-sm text-destructive" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {status.message}
            </p>
          ) : null}

          <Button type="submit" disabled={drafting}>
            {drafting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="h-4 w-4" aria-hidden />
            )}
            {drafting ? "Drafting the letter…" : "Download Word draft"}
          </Button>
          {drafting ? (
            <p className="text-xs text-muted-foreground">
              This can take up to a minute while the treatment section is
              written and checked.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </form>
  );
}
