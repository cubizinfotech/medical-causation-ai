"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, getAccessToken } from "@/lib/config";
import type { AuthSessionUser } from "./auth-session";

export interface ProductActivity {
  total: number;
  byStatus: Record<string, number>;
  lastActivityAt: string | null;
}

export interface RecentActivityItem {
  product: "mca" | "ewi";
  id: string;
  title: string;
  subtitle: string;
  status: string;
  createdAt: string;
}

export interface ProfileDetails {
  displayName: string;
  jobTitle: string | null;
  organization: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
}

export interface UserProfile extends ProfileDetails {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  avatarUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  activity: { mca: ProductActivity; ewi: ProductActivity };
  recent: RecentActivityItem[];
}

/** Photo change staged in the edit form and applied on save. */
export type PhotoChange =
  | { kind: "keep" }
  | { kind: "replace"; dataUrl: string }
  | { kind: "remove" };

export const profileQueryKey = ["auth", "profile"] as const;

async function readProfile(response: Response): Promise<UserProfile> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? (payload as { message: unknown }).message
        : null;
    throw new Error(
      Array.isArray(message)
        ? message.join(" ")
        : typeof message === "string"
          ? message
          : `Request failed (${response.status}).`,
    );
  }
  return payload as UserProfile;
}

export function useProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: async () => readProfile(await apiFetch("/auth/profile")),
    staleTime: 15_000,
  });
}

/** Saves details, then applies the staged photo change. */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      details,
      photo,
    }: {
      details: ProfileDetails;
      photo: PhotoChange;
    }) => {
      let profile = await readProfile(
        await apiFetch("/auth/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(details),
        }),
      );
      if (photo.kind === "replace") {
        profile = await readProfile(
          await apiFetch("/auth/profile/avatar", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl: photo.dataUrl }),
          }),
        );
      } else if (photo.kind === "remove") {
        profile = await readProfile(
          await apiFetch("/auth/profile/avatar", { method: "DELETE" }),
        );
      }
      return profile;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey, profile);
      // Keep the header avatar and name in sync without refetching /auth/me.
      queryClient.setQueryData<AuthSessionUser | null>(
        ["auth", "me"],
        (current) =>
          current
            ? {
                ...current,
                displayName: profile.displayName,
                avatarUpdatedAt: profile.avatarUpdatedAt,
              }
            : current,
      );
    },
  });
}

/**
 * Loads the signed-in user's photo as a data URL. The endpoint needs the
 * bearer token, so a plain <img src> cannot fetch it. The cache key is the
 * photo's timestamp, so a new photo is fetched once and then reused.
 */
export function useAvatarUrl(avatarUpdatedAt: string | null | undefined) {
  return useQuery({
    queryKey: ["auth", "avatar", avatarUpdatedAt ?? "none"],
    enabled: Boolean(avatarUpdatedAt),
    staleTime: Infinity,
    queryFn: async () => {
      const response = await apiFetch("/auth/profile/avatar");
      if (!response.ok) return null;
      return blobToDataUrl(await response.blob());
    },
  }).data;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const AVATAR_SIZE = 256;
/** Server limit is 64 KB; stay under it with room for base64 rounding. */
const AVATAR_TARGET_BYTES = 60 * 1024;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

/** Center-crops to a square and resizes to 256×256 WebP (JPEG fallback). */
export async function prepareAvatar(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Choose an image smaller than 10 MB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That image could not be read. Try a different file.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser cannot process images.");
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();

  for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5]) {
    let dataUrl = canvas.toDataURL("image/webp", quality);
    // Browsers without WebP encoding return PNG instead.
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrlBytes(dataUrl) <= AVATAR_TARGET_BYTES) return dataUrl;
  }
  throw new Error("That image is too detailed to compress. Try another one.");
}

/** Reads the expiry from the stored JWT. The signature is checked by the API, not here. */
export function readSessionExpiry(): Date | null {
  const token = getAccessToken();
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    return typeof json.exp === "number" ? new Date(json.exp * 1000) : null;
  } catch {
    return null;
  }
}

export function initialsFor(name: string, email: string): string {
  const source = name && name !== email ? name : email.split("@")[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}
