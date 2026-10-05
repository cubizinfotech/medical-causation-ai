"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/components/layout";
import { useAuth } from "@/features/auth/auth-session";

function LoginForm() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    const next = params.get("next");
    router.replace(next && next.startsWith("/") ? next : "/");
  }, [params, ready, router, user]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password);
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <PageContainer size="narrow" className="py-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Medical causation analyses and expert investigations are private to
        your account.
      </p>
      <form onSubmit={(event) => void onSubmit(event)} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      </div>
    </PageContainer>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
