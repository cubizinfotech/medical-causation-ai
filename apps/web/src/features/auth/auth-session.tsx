"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  const logout = useCallback(() => {
    setAccessToken(null);
    queryClient.setQueryData(["auth", "me"], null);
  }, [queryClient]);

  const value = useMemo(
    () => ({
      enabled: status.data?.enabled === true,
      user: me.data ?? null,
      ready: !status.isPending && !me.isPending,
      login,
      logout,
    }),
    [
      status.data?.enabled,
      status.isPending,
      me.data,
      me.isPending,
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

export function AuthGate({ children }: { children: ReactNode }) {
  const { enabled, user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const protectedPath =
    pathname.startsWith("/mca") || pathname.startsWith("/ewi");

  useEffect(() => {
    if (!ready || !enabled || !protectedPath || user) return;
    const next = encodeURIComponent(pathname);
    router.replace(`/login?next=${next}`);
  }, [enabled, pathname, protectedPath, ready, router, user]);

  if (ready && enabled && protectedPath && !user) {
    return null;
  }

  return children;
}
