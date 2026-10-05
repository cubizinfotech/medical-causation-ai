"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiFetch, getAccessToken, setAccessToken } from "@/lib/config";

export interface AuthSessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  attorney: "Attorney",
  paralegal: "Paralegal",
  medical_expert: "Medical Expert",
  user: "User",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

interface AuthContextValue {
  enabled: boolean;
  user: AuthSessionUser | null;
  ready: boolean;
  signingOut: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["auth", "status"],
    queryFn: async () => {
      const response = await apiFetch("/auth/status");
      if (!response.ok) return { enabled: false };
      return (await response.json()) as { enabled: boolean };
    },
  });

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) return null;
      const response = await apiFetch("/auth/me");
      if (!response.ok) {
        setAccessToken(null);
        return null;
      }
      return (await response.json()) as AuthSessionUser;
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "message" in payload
            ? String((payload as { message: unknown }).message)
            : "Login failed";
        throw new Error(message);
      }
      const body = payload as { accessToken: string; user: AuthSessionUser };
      setAccessToken(body.accessToken);
      queryClient.setQueryData(["auth", "me"], body.user);
    },
    [queryClient],
  );

  const [signingOut, setSigningOut] = useState(false);
  const logout = useCallback(() => {
    setSigningOut(true);
    setAccessToken(null);
    queryClient.setQueryData(["auth", "me"], null);
    setSigningOut(false);
  }, [queryClient]);

  const value = useMemo(
    () => ({
      enabled: status.data?.enabled === true,
      user: me.data ?? null,
      ready: !status.isPending && !me.isPending,
      signingOut,
      login,
      logout,
    }),
    [
      status.data?.enabled,
      status.isPending,
      me.data,
      me.isPending,
      signingOut,
      login,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}

const PRIVATE_PREFIXES = [
  "/mca",
  "/ewi",
  "/case",
  "/analysis",
  "/histories",
  "/report",
];

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const requiresAuth = isPrivatePath(pathname);

  useEffect(() => {
    if (!ready || !requiresAuth || user) return;
    const next = encodeURIComponent(pathname || "/");
    router.replace(`/login?next=${next}`);
  }, [pathname, ready, requiresAuth, router, user]);

  if (requiresAuth && !ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Checking your session…
      </div>
    );
  }

  if (requiresAuth && !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Redirecting to sign in…
      </div>
    );
  }

  return children;
}
