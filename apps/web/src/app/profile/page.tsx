"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Camera,
  Copy,
  FileSearch,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { PageContainer } from "@/components/layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { roleLabel, useAuth } from "@/features/auth/auth-session";
import {
  readSessionExpiry,
  useProfile,
  type ProductActivity,
  type RecentActivityItem,
} from "@/features/auth/profile";
import { formatReportDate } from "@/utils/format-date";
import { cn } from "@/utils/cn";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { UserAvatar } from "@/components/profile/user-avatar";

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_ORDER = ["completed", "running", "queued", "pending", "failed", "cancelled"];

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === "completed"
          ? "default"
          : status === "failed"
            ? "destructive"
            : status === "cancelled"
              ? "outline"
              : "secondary"
      }
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function OptionalValue({ value }: { value: string | null }) {
  return value ? (
    <span className="break-words">{value}</span>
  ) : (
    <span className="font-normal text-muted-foreground">Not set</span>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-foreground sm:text-right">
        {children}
      </dd>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

function ActivityCard({
  title,
  description,
  icon: Icon,
  activity,
  historiesHref,
  newHref,
  newLabel,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  activity: ProductActivity;
  historiesHref: string;
  newHref: string;
  newLabel: string;
}) {
  const statuses = STATUS_ORDER.filter((status) => activity.byStatus[status]);
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums tracking-tight text-foreground">
            {activity.total}
          </span>
          <span className="text-sm text-muted-foreground">
            {activity.total === 1 ? "run" : "runs"} total
          </span>
        </div>
        {statuses.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status === "completed" && "bg-primary",
                    status === "failed" && "bg-destructive",
                    status === "cancelled" && "bg-muted-foreground",
                    ["running", "queued", "pending"].includes(status) &&
                      "bg-amber-500",
                  )}
                  aria-hidden
                />
                <span className="text-muted-foreground">
                  {STATUS_LABELS[status] ?? status}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {activity.byStatus[status]}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing run yet.</p>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {activity.lastActivityAt
            ? `Last started ${formatReportDate(activity.lastActivityAt)}`
            : "No activity yet"}
        </p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button asChild variant="outline" size="sm">
            <Link href={historiesHref}>View histories</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={newHref}>{newLabel}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentList({ items }: { items: RecentActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Your analyses and investigations will appear here.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/mca/case">New analysis</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/ewi/intake">New investigation</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={`${item.product}-${item.id}`}>
          <Link
            href={`/${item.product}/histories/${item.id}`}
            className="group -mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60"
          >
            <span
              className={cn(
                "flex h-9 w-12 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                item.product === "mca"
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {item.product.toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {item.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {item.subtitle} · {formatReportDate(item.createdAt)}
              </span>
            </span>
            <StatusBadge status={item.status} />
            <ArrowRight
              className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading profile">
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { logout } = useAuth();
  const profile = useProfile();
  const [sessionExpiry] = useState(readSessionExpiry);
  const [editing, setEditing] = useState(false);

  const signOut = () => {
    logout();
    router.push("/login");
  };

  const data = profile.data;
  const showName = data && data.displayName !== data.email;
  const headline = [data?.jobTitle, data?.organization]
    .filter(Boolean)
    .join(" · ");
  const hasProductAccess = (product: "mca" | "ewi") =>
    Boolean(
      data?.permissions.some(
        (permission) =>
          permission === `${product}:*` || permission.startsWith(`${product}:`),
      ),
    );

  return (
    <PageContainer className="py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">
              Dashboard
            </Link>{" "}
            / Profile
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            Your Profile
          </h1>
          <p className="mt-1 text-muted-foreground">
            Account details and your research activity.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void profile.refetch()}
          disabled={profile.isFetching}
        >
          <RefreshCw
            className={cn("h-4 w-4", profile.isFetching && "animate-spin")}
            aria-hidden
          />
          Refresh
        </Button>
      </div>

      {profile.isPending ? <ProfileSkeleton /> : null}

      {profile.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Profile unavailable</AlertTitle>
          <AlertDescription>{profile.error.message}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-primary/20 via-accent to-primary/5" />
            <CardContent className="-mt-10 flex flex-col gap-5 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label="Change profile photo"
                  className="group relative w-fit rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <UserAvatar
                    displayName={data.displayName}
                    email={data.email}
                    avatarUpdatedAt={data.avatarUpdatedAt}
                    className="h-20 w-20 rounded-2xl border-4 border-card text-2xl shadow-sm"
                  />
                  <span className="absolute inset-1 flex items-center justify-center rounded-xl bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Camera className="h-5 w-5" aria-hidden />
                  </span>
                </button>
                <div className="min-w-0 space-y-1.5">
                  <h2 className="truncate text-xl font-semibold text-foreground">
                    {showName ? data.displayName : data.email}
                  </h2>
                  {headline ? (
                    <p className="truncate text-sm text-foreground/80">
                      {headline}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {showName ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{data.email}</span>
                      </span>
                    ) : null}
                    {data.location ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {data.location}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {data.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {roleLabel(role)}
                      </Badge>
                    ))}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      Member since {formatDay(data.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  Edit profile
                </Button>
                <Button variant="outline" onClick={signOut}>
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out
                </Button>
              </div>
            </CardContent>
            {data.bio ? (
              <div className="border-t border-border px-6 py-4">
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                  {data.bio}
                </p>
              </div>
            ) : null}
          </Card>

          {editing ? (
            <EditProfileDialog
              profile={data}
              onClose={() => setEditing(false)}
            />
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Account details</CardTitle>
                    <CardDescription className="mt-1">
                      Email and role are managed by your administrator.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border">
                  <DetailRow label="Full name">{data.displayName}</DetailRow>
                  <DetailRow label="Job title">
                    <OptionalValue value={data.jobTitle} />
                  </DetailRow>
                  <DetailRow label="Firm / organization">
                    <OptionalValue value={data.organization} />
                  </DetailRow>
                  <DetailRow label="Phone">
                    <OptionalValue value={data.phone} />
                  </DetailRow>
                  <DetailRow label="Location">
                    <OptionalValue value={data.location} />
                  </DetailRow>
                  <DetailRow label="Email">
                    <span className="break-all">{data.email}</span>
                  </DetailRow>
                  <DetailRow label="Role">
                    {data.roles.map(roleLabel).join(", ") || "—"}
                  </DetailRow>
                  <DetailRow label="User ID">
                    <span className="inline-flex max-w-full items-center gap-1">
                      <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {data.id}
                      </code>
                      <CopyButton value={data.id} label="Copy user ID" />
                    </span>
                  </DetailRow>
                  <DetailRow label="Member since">
                    {formatReportDate(data.createdAt)}
                  </DetailRow>
                  <DetailRow label="Last updated">
                    {formatReportDate(data.updatedAt)}
                  </DetailRow>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Access &amp; session</CardTitle>
                <CardDescription>
                  What this account can use, and this browser&apos;s sign-in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2 pt-2">
                  {(
                    [
                      ["mca", "Medical Causation Analysis", Stethoscope],
                      ["ewi", "Expert Witness Investigation", FileSearch],
                    ] as const
                  ).map(([product, label, Icon]) => {
                    const allowed = hasProductAccess(product);
                    return (
                      <div
                        key={product}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                      >
                        <span className="flex items-center gap-2.5 text-sm text-foreground">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {label}
                        </span>
                        {allowed ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-primary">
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                            Access
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No access
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {data.permissions.includes("platform:users:read") ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                      <span className="flex items-center gap-2.5 text-sm text-foreground">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        User administration
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-primary">
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        View users
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <KeyRound className="h-4 w-4 text-primary" aria-hidden />
                    Signed in on this browser
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sessionExpiry
                      ? `Your session expires ${formatReportDate(sessionExpiry.toISOString())}. You will need to sign in again after that.`
                      : "Your session is active."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <ActivityCard
              title="Causation analyses"
              description="Medical Causation Analysis"
              icon={Stethoscope}
              activity={data.activity.mca}
              historiesHref="/mca/histories"
              newHref="/mca/case"
              newLabel="New analysis"
            />
            <ActivityCard
              title="Expert investigations"
              description="Expert Witness Investigation"
              icon={FileSearch}
              activity={data.activity.ewi}
              historiesHref="/ewi/histories"
              newHref="/ewi/intake"
              newLabel="New investigation"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent activity</CardTitle>
              <CardDescription>
                Your latest analyses and investigations across both products.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentList items={data.recent} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageContainer>
  );
}
