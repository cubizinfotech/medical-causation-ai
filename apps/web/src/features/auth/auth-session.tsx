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
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  AUTH_EXPIRED_EVENT,
  apiFetch,
  getAccessToken,
  setAccessToken,
} from "@/lib/config";

export interface AuthSessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  avatarUpdatedAt?: string | null;
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
  user: AuthSessionUser | null;
  ready: boolean;
  signingOut: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Removes everything this browser kept for the signed-in user: the token,
 * case drafts and results in sessionStorage, and saved letterhead details.
 */
function clearStoredSession(): void {
  setAccessToken(null);
  try {
    sessionStorage.clear();
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("mca:") || key.startsWith("ewi:")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage can be unavailable (private mode); nothing to clear then.
  }
}

const ME_KEY = ["auth", "me"] as const;

/**
 * Drops every cached API answer of the previous user and sets the signed-in
 * user. queryClient.clear() must not be used here: it detaches the mounted
 * ["auth", "me"] query, so the page would keep showing the old value.
 */
function resetSessionCache(
  queryClient: QueryClient,
  user: AuthSessionUser | null,
): void {
  void queryClient.cancelQueries();
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== ME_KEY[0],
  });
  queryClient.setQueryData(ME_KEY, user);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      if (!getAccessToken()) return null;
      const response = await apiFetch("/auth/me");
      if (!response.ok) {
        setAccessToken(null);
        return null;
      }
      return (await response.json()) as AuthSessionUser;
    },
  });

  // The API rejected the saved token (expired or signed out elsewhere).
  useEffect(() => {
    const onExpired = () => {
      clearStoredSession();
      resetSessionCache(queryClient, null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [queryClient]);

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
          response.status === 429
            ? "Too many sign-in attempts. Wait a minute and try again."
            : typeof payload === "object" &&
                payload !== null &&
                "message" in payload
              ? String((payload as { message: unknown }).message)
              : "Login failed";
        throw new Error(message);
      }
      const body = payload as { accessToken: string; user: AuthSessionUser };
      // Nothing from a previous user may show for this one.
      clearStoredSession();
      setAccessToken(body.accessToken);
      resetSessionCache(queryClient, body.user);
    },
    [queryClient],
  );

  const [signingOut, setSigningOut] = useState(false);
  const logout = useCallback(async () => {
    setSigningOut(true);
    try {
      // Revokes the token on the server; the local session ends regardless.
      await apiFetch("/auth/logout", { method: "POST" }).catch(() => null);
    } finally {
      clearStoredSession();
      resetSessionCache(queryClient, null);
      setSigningOut(false);
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user: me.data ?? null,
      ready: !me.isPending,
      signingOut,
      login,
      logout,
    }),
    [me.data, me.isPending, signingOut, login, logout],
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

const PRIVATE_PREFIXES = ["/mca", "/ewi", "/profile"];

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
