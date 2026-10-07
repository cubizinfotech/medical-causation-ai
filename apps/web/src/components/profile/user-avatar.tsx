"use client";

import { initialsFor, useAvatarUrl } from "@/features/auth/profile";
import { cn } from "@/utils/cn";

interface UserAvatarProps {
  displayName: string;
  email: string;
  avatarUpdatedAt?: string | null;
  /** Shows this image instead (e.g. an unsaved photo in the edit form). */
  previewUrl?: string | null;
  /** True hides the saved photo (e.g. "Remove photo" staged in the form). */
  hidePhoto?: boolean;
  className?: string;
}

/** Profile photo, or initials on a teal background when there is none. */
export function UserAvatar({
  displayName,
  email,
  avatarUpdatedAt,
  previewUrl,
  hidePhoto = false,
  className,
}: UserAvatarProps) {
  const savedUrl = useAvatarUrl(hidePhoto ? null : avatarUpdatedAt);
  const src = previewUrl ?? (hidePhoto ? null : savedUrl);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      {src ? (
        // A data URL from our own API; next/image adds nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsFor(displayName, email)
      )}
    </span>
  );
}
