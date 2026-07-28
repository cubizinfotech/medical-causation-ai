import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  FileSearch,
  Scale,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/layout";
import { InfoCard } from "@/components/demo";
import { appMetadata } from "@/lib/config";

const features = [
  {
    title: "Knowledge Base RAG",
    description:
      "Hybrid vector and keyword search across indexed medical textbooks and private documents.",
    icon: BookOpen,
  },
  {
    title: "Evidence Classification",
    description:
      "AI separates supporting, opposing, neutral, and unknown evidence with cited reasoning.",
    icon: Scale,
  },
  {
    title: "Causation Reasoning",
    description:
      "Structured medical causation analysis grounded in retrieved scientific literature.",
    icon: Brain,
  },
  {
    title: "Citation Safety",
    description:
      "Every claim maps to retrieved chunks — hallucinated citations are blocked by validation.",
    icon: Shield,
  },
];

const workflow = [
  "Collect patient and accident details",
  "Search the private knowledge base",
  "Retrieve and rank medical evidence",
  "Build attorney-ready context",
  "Generate structured AI reasoning",
];

const tech = [
  "Next.js · React · TypeScript",
  "NestJS · PostgreSQL · pgvector",
  "OpenRouter / multi-provider LLM",
  "TanStack Query · React Hook Form · Zod",
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-accent/40 to-background">
        <PageContainer size="wide" className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              {appMetadata.phase}
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Medical Causation AI Platform
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Help personal injury attorneys evaluate whether trauma or accidents
              medically contributed to injury or disease — using scientific
              evidence, RAG retrieval, and structured AI reasoning.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/case">
                  Start AI Demonstration
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/case">Enter Medical Case</Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer size="wide" className="py-16">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-semibold">Key Features</h2>
          <p className="mt-2 text-muted-foreground">
            Production architecture demonstrated through a real end-to-end workflow.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <InfoCard key={feature.title} {...feature} />
          ))}
        </div>
      </PageContainer>

      <section className="border-y border-border bg-muted/30 py-16">
        <PageContainer size="wide">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">
                  Workflow
                </span>
              </div>
              <h2 className="text-2xl font-semibold">From case to evidence-based analysis</h2>
              <p className="mt-3 text-muted-foreground">
                The demonstration walks through the same pipeline used in production:
                case intake, knowledge retrieval, context building, and structured medical reasoning.
              </p>
            </div>
            <ol className="space-y-4">
              {workflow.map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </PageContainer>
      </section>

      <PageContainer size="wide" className="py-16">
        <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-primary">
                <FileSearch className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">
                  Technology
                </span>
              </div>
              <h2 className="text-2xl font-semibold">Enterprise-ready stack</h2>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {tech.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <Button asChild size="lg">
              <Link href="/case">Start AI Demonstration</Link>
            </Button>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
