"use client";

import { AlertTriangle, FileWarning, Info } from "lucide-react";
import type {
  BillingCharge,
  BillingPrintedTotal,
  MedicalSpecials,
  ProviderBilling,
} from "@/features/mca/medical-analysis/types";
import { formatEventDate, formatPageList } from "@/features/mca/records/format";
import { RecordPageLink } from "@/components/mca/report/record-page-link";
import { cn } from "@/utils/cn";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const PRINTED_LABEL: Record<BillingPrintedTotal["kind"], string> = {
  total_charges: "Total charges",
  payments: "Payments",
  adjustments: "Adjustments",
  balance: "Balance due",
};

function dateRange(first: string, last: string): string {
  if (!first) return "Dates not printed";
  return first === last
    ? formatEventDate(first)
    : `${formatEventDate(first)} – ${formatEventDate(last)}`;
}

function ChargeRow({ charge }: { charge: BillingCharge }) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 align-top",
        charge.duplicateOf && "text-muted-foreground",
      )}
    >
      <td className="py-1.5 pr-3 tabular-nums">
        {charge.dateOfService ? formatEventDate(charge.dateOfService) : "—"}
      </td>
      <td className="py-1.5 pr-3">
        {charge.description}
        {charge.code ? (
          <span className="ml-1 font-mono text-xs text-muted-foreground">
            {charge.code}
          </span>
        ) : null}
        {charge.duplicateOf ? (
          <span className="block text-xs">
            Printed again; counted once ({charge.duplicateOf})
          </span>
        ) : null}
        {!charge.quoteVerified ? (
          <span className="block text-xs text-amber-700 dark:text-amber-300">
            Line not matched exactly; check the page
          </span>
        ) : null}
      </td>
      <td
        className={cn(
          "py-1.5 pr-3 text-right tabular-nums",
          charge.duplicateOf && "line-through",
        )}
      >
        {money.format(charge.amount)}
      </td>
      <td className="py-1.5 text-xs">
        <RecordPageLink recordId={charge.recordId} pageNumber={charge.pageNumber}>
          {charge.documentName} p. {charge.pageNumber}
        </RecordPageLink>
      </td>
    </tr>
  );
}

function ProviderItem({
  provider,
  charges,
}: {
  provider: ProviderBilling;
  charges: BillingCharge[];
}) {
  return (
    <li className="rounded-lg border border-border">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="font-semibold text-foreground">
              {provider.provider}
            </span>
            <span className="block text-xs text-muted-foreground">
              {dateRange(provider.firstDate, provider.lastDate)} ·{" "}
              {provider.billedFrom === "printed_total"
                ? "from the total printed on the bill"
                : `${provider.chargeCount} ${provider.chargeCount === 1 ? "charge" : "charges"}`}
            </span>
          </span>
          <span className="font-semibold tabular-nums">
            {money.format(provider.billed)}
          </span>
        </summary>
        <div className="space-y-3 border-t border-border px-4 py-3 text-sm">
          {provider.mismatch ? (
            <p className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              The lines read add up to {money.format(provider.mismatch.read)},
              but {provider.mismatch.documentName} p.{" "}
              {provider.mismatch.pageNumber} prints total charges of{" "}
              {money.format(provider.mismatch.printed)}. Check the bill for
              missed lines.
            </p>
          ) : null}
          {charges.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Date of service</th>
                    <th className="py-1.5 pr-3 font-medium">Service</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Charge</th>
                    <th className="py-1.5 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((charge) => (
                    <ChargeRow key={charge.id} charge={charge} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {provider.printedTotals.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-foreground">
                Printed on the bill
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {provider.printedTotals.map((total) => (
                  <li key={`${total.kind}-${total.recordId}-${total.pageNumber}-${total.amount}`}>
                    {PRINTED_LABEL[total.kind]}: {money.format(total.amount)} ·{" "}
                    <RecordPageLink
                      recordId={total.recordId}
                      pageNumber={total.pageNumber}
                    >
                      {total.documentName} p. {total.pageNumber}
                    </RecordPageLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </li>
  );
}

/**
 * Charges read from the pages that look like bills. Every amount is printed
 * on its cited page; totals are added from the lines, not by the AI.
 */
export function MedicalSpecialsSection({
  specials,
}: {
  specials: MedicalSpecials;
}) {
  const chargesOf = (provider: ProviderBilling) =>
    specials.charges.filter((charge) => charge.provider === provider.provider);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Read from the pages that look like bills. Every amount is printed on
        the cited page, and the totals are added from those lines; a charge
        printed on two pages counts once. Whether billed or paid amounts are
        recoverable depends on your state&apos;s collateral-source rule.
      </p>

      {specials.status === "no_bills" ? (
        <p className="flex gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          No page in the uploaded records looks like a bill. Upload itemized
          bills (UB-04, CMS-1500, or provider statements) with the records to
          total the medical expenses.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Total billed · {specials.providers.length}{" "}
              {specials.providers.length === 1 ? "provider" : "providers"}
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {money.format(specials.totalBilled)}
            </p>
          </div>

          {specials.providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pages that look like bills were read, but no charges were found
              on them.
            </p>
          ) : (
            <ul className="space-y-2">
              {specials.providers.map((provider) => (
                <ProviderItem
                  key={provider.provider}
                  provider={provider}
                  charges={chargesOf(provider)}
                />
              ))}
            </ul>
          )}

          <p className="text-xs text-muted-foreground">
            Bill pages read:{" "}
            {specials.billPages
              .map(
                (entry) =>
                  `${entry.documentName} p. ${formatPageList(entry.pages)}`,
              )
              .join("; ")}
          </p>
        </>
      )}

      {specials.unbilledProviders.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Treatment with no bill in the records
          </p>
          <p className="text-xs text-muted-foreground">
            These providers appear in the chronology, but no bill with a
            matching name was found. Request itemized bills from them. Names
            are matched by their distinctive words, so check the list.
          </p>
          <ul className="space-y-1 text-sm">
            {specials.unbilledProviders.map((provider) => (
              <li
                key={provider.provider}
                className="flex flex-wrap justify-between gap-x-4 rounded-md border border-border px-3 py-2"
              >
                <span className="font-medium">{provider.provider}</span>
                <span className="text-xs text-muted-foreground">
                  {dateRange(provider.firstDate, provider.lastDate)} ·{" "}
                  {provider.visits}{" "}
                  {provider.visits === 1 ? "entry" : "entries"} (
                  {provider.chronologyIds.join(", ")})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {specials.warnings.length > 0 ? (
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {specials.warnings.map((warning) => (
            <li key={warning} className="flex gap-1.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
