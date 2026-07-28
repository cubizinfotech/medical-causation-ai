import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  FileText,
  Gavel,
  Globe,
  Scale,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/layout";
import {
  HOW_IT_WORKS_STEPS,
  LANDING_CAPABILITIES,
} from "@/features/demo/constants";
import { appMetadata } from "@/lib/config";

const capabilityIcons = [Brain, Globe, FileText, Gavel];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <PageContainer size="wide" className="relative py-20 sm:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-6">
              Enterprise AI for Personal Injury Law
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl sm:leading-tight">
              Medical Causation Analysis,{" "}
              <span className="text-primary">Powered by AI</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Help attorneys evaluate whether trauma or accidents medically
              contributed to injury or disease — with evidence from private
              knowledge bases and public medical literature.
            </p>
            <div className="mt-10">
              <Button asChild size="lg" className="h-12 px-8 text-base">
                <Link href="/case">
                  Start Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer size="wide" className="py-20">
        <div className="mb-12 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">
              Platform Capabilities
            </span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            Built for law firms and medical-legal teams
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {LANDING_CAPABILITIES.map((item, index) => {
            const Icon = capabilityIcons[index] ?? BookOpen;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-border/80 bg-card p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </PageContainer>

      <section className="border-y border-border bg-muted/40 py-20">
        <PageContainer size="wide">
          <div className="mb-12 text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-primary">
              <Scale className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                How It Works
              </span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              From case intake to attorney-ready report
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div
                key={step.step}
                className="relative rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {step.step}
                </span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      <PageContainer size="wide" className="py-20">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/30 p-10 text-center sm:p-14">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Ready to evaluate medical causation?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Run the interactive demonstration with sample cases or your own
            intake data. {appMetadata.name} searches private and public sources
            to produce evidence-based reports.
          </p>
          <Button asChild size="lg" className="mt-8 h-12 px-8">
            <Link href="/case">Start Demo</Link>
          </Button>
        </div>
      </PageContainer>
    </>
  );
}
