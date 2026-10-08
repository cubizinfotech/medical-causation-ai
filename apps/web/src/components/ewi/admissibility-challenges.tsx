import { Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  EwiExpertChallenge,
  EwiLegalResearch,
} from "@/features/ewi/types";

type ChallengeRecord = NonNullable<EwiLegalResearch["challenges"]>[number];

const OUTCOME_LABEL: Record<EwiExpertChallenge["outcome"], string> = {
  excluded: "Excluded",
  limited: "Limited",
  admitted: "Admitted",
  not_challenged: "Not about this expert",
  not_determined: "Not determined",
};

const STANDARD_LABEL: Record<EwiExpertChallenge["standard"], string> = {
  daubert: "Daubert",
  frye: "Frye",
  rule_702: "Rule 702",
  unspecified: "Admissibility",
};

function outcomeVariant(
  outcome: EwiExpertChallenge["outcome"],
): "destructive" | "secondary" | "outline" | "default" {
  if (outcome === "excluded") return "destructive";
  if (outcome === "limited") return "secondary";
  if (outcome === "admitted") return "default";
  return "outline";
}

/**
 * Court opinions with Daubert/Frye/Rule 702 language. An outcome is shown
 * only when the court's own words, quoted exactly, state it.
 */
export function AdmissibilityChallenges({
  records,
}: {
  records: ChallengeRecord[];
}) {
  const counts = records.reduce<Record<string, number>>((totals, record) => {
    const label = OUTCOME_LABEL[record.challenge.outcome];
    totals[label] = (totals[label] ?? 0) + 1;
    return totals;
  }, {});

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">
        Opinions that name the expert with a specialty term and Daubert, Frye,
        Rule 702, or motion-to-exclude language. An outcome is shown only when
        the court&apos;s own words state it; otherwise read the opinion.
      </p>
      <p className="flex flex-wrap gap-2">
        {Object.entries(counts).map(([label, count]) => (
          <Badge key={label} variant="outline">
            {label}: {count}
          </Badge>
        ))}
      </p>
      <ul className="space-y-3">
        {records.map(({ matter, challenge, sortDate }) => (
          <li key={matter.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{matter.caseName ?? matter.title}</p>
              <Badge variant={outcomeVariant(challenge.outcome)}>
                {OUTCOME_LABEL[challenge.outcome]}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {STANDARD_LABEL[challenge.standard]}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {[matter.court, matter.citation, sortDate]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {challenge.basis === "court_text" && challenge.quote ? (
              <blockquote className="mt-2 flex gap-2 border-l-2 border-primary/40 pl-3 text-sm">
                <Quote
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span>{challenge.quote}</span>
              </blockquote>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  {challenge.note}
                </p>
                {challenge.excerpts.length > 0 ? (
                  <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      {challenge.excerptSource === "opinion_text"
                        ? "Opinion excerpts"
                        : "Search excerpts"}{" "}
                      ({challenge.excerpts.length})
                    </summary>
                    <ul className="mt-1 space-y-1">
                      {challenge.excerpts.map((excerpt) => (
                        <li key={excerpt}>“{excerpt}”</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            )}
            {matter.sourceUrl ? (
              <a
                href={matter.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block break-all text-sm text-primary underline-offset-2 hover:underline"
              >
                Read the opinion
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
