import type { EwiExpertPortrait } from "@/features/ewi/types";

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * A public photo of the expert, only when research read one from a sourced
 * page. Nothing is shown when there is no photo.
 */
export function ExpertPortrait({
  portrait,
  name,
  size = "md",
}: {
  portrait: EwiExpertPortrait | null | undefined;
  name: string;
  size?: "sm" | "md";
}) {
  if (!portrait?.dataUrl) return null;
  const host = hostOf(portrait.sourceUrl);
  const box = size === "sm" ? "h-14 w-14" : "h-20 w-20";
  return (
    <figure className="shrink-0">
      {/* Sourced data URL from research, not a remote asset to optimize. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={portrait.dataUrl}
        alt={`Public photo of ${name}`}
        className={`${box} rounded-lg border border-border object-cover bg-muted`}
      />
      {host ? (
        <figcaption className="mt-1 max-w-[7rem] text-[10px] leading-tight text-muted-foreground">
          Photo from {host}
        </figcaption>
      ) : null}
    </figure>
  );
}
