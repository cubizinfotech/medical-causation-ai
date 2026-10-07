"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, Loader2, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/mca/demo/form-field";
import { UserAvatar } from "@/components/profile/user-avatar";
import {
  prepareAvatar,
  useSaveProfile,
  type PhotoChange,
  type UserProfile,
} from "@/features/auth/profile";

const BIO_MAX = 500;

// Mirrors UpdateProfileDto in the API.
const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Keep the name under 80 characters"),
  jobTitle: z.string().trim().max(120, "Keep this under 120 characters"),
  organization: z.string().trim().max(120, "Keep this under 120 characters"),
  phone: z
    .string()
    .trim()
    .max(40, "Keep the phone number under 40 characters")
    .regex(/^[0-9+()\-.\s]*$/, "Use digits, spaces, and + ( ) - . only"),
  location: z.string().trim().max(120, "Keep this under 120 characters"),
  bio: z.string().trim().max(BIO_MAX, `Keep the bio under ${BIO_MAX} characters`),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function toFormValues(profile: UserProfile): ProfileFormValues {
  return {
    displayName: profile.displayName,
    jobTitle: profile.jobTitle ?? "",
    organization: profile.organization ?? "",
    phone: profile.phone ?? "",
    location: profile.location ?? "",
    bio: profile.bio ?? "",
  };
}

interface EditProfileDialogProps {
  profile: UserProfile;
  onClose: () => void;
}

/** Mount only while open; the form starts from the current profile each time. */
export function EditProfileDialog({ profile, onClose }: EditProfileDialogProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<PhotoChange>({ kind: "keep" });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const save = useSaveProfile();

  const {
    register,
    handleSubmit,
    control,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: toFormValues(profile),
  });

  const busy = save.isPending || photoBusy;
  const [bio, liveName] = useWatch({ control, name: ["bio", "displayName"] });
  const bioLength = bio?.length ?? 0;
  const hasSavedPhoto = Boolean(profile.avatarUpdatedAt);
  const showsPhoto =
    photo.kind === "replace" || (photo.kind === "keep" && hasSavedPhoto);
  const hasChanges = isDirty || photo.kind !== "keep";

  useEffect(() => {
    setFocus("displayName");
  }, [setFocus]);

  // Lock page scroll and close on Escape while the dialog is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onClose]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      setPhoto({ kind: "replace", dataUrl: await prepareAvatar(file) });
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : "That image could not be used.",
      );
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSubmit = handleSubmit((values) => {
    save.mutate(
      {
        details: {
          displayName: values.displayName,
          jobTitle: values.jobTitle,
          organization: values.organization,
          phone: values.phone,
          location: values.location,
          bio: values.bio,
        },
        photo,
      },
      { onSuccess: onClose },
    );
  });

  const fieldA11y = (name: keyof ProfileFormValues) => ({
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              Edit profile
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your name and photo appear in the header and on your profile.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          autoComplete="off"
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <section className="flex flex-col items-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Choose a profile photo"
              >
                <UserAvatar
                  displayName={liveName || profile.displayName}
                  email={profile.email}
                  avatarUpdatedAt={profile.avatarUpdatedAt}
                  previewUrl={photo.kind === "replace" ? photo.dataUrl : null}
                  hidePhoto={photo.kind === "remove"}
                  className="h-24 w-24 text-2xl"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {photoBusy ? (
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="h-6 w-6" aria-hidden />
                  )}
                </span>
              </button>
              <div className="space-y-2 text-center sm:text-left">
                <p className="text-sm font-medium text-foreground">
                  Profile photo
                </p>
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" aria-hidden />
                    {showsPhoto ? "Change photo" : "Upload photo"}
                  </Button>
                  {showsPhoto ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        setPhoto(
                          hasSavedPhoto ? { kind: "remove" } : { kind: "keep" },
                        )
                      }
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Remove
                    </Button>
                  ) : null}
                </div>
                {photoError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {photoError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, or WebP up to 10 MB. Cropped to a square.
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => void pickPhoto(event.target.files?.[0])}
              />
            </section>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                id="displayName"
                label="Full name"
                required
                error={errors.displayName?.message}
                className="sm:col-span-2"
              >
                <Input
                  id="displayName"
                  autoComplete="off"
                  placeholder="e.g. Jane A. Smith"
                  {...fieldA11y("displayName")}
                  {...register("displayName")}
                />
              </FormField>
              <FormField
                id="jobTitle"
                label="Job title"
                error={errors.jobTitle?.message}
              >
                <Input
                  id="jobTitle"
                  autoComplete="off"
                  placeholder="e.g. Partner"
                  {...fieldA11y("jobTitle")}
                  {...register("jobTitle")}
                />
              </FormField>
              <FormField
                id="organization"
                label="Firm / organization"
                error={errors.organization?.message}
              >
                <Input
                  id="organization"
                  autoComplete="off"
                  placeholder="e.g. Smith & Lee LLP"
                  {...fieldA11y("organization")}
                  {...register("organization")}
                />
              </FormField>
              <FormField id="phone" label="Phone" error={errors.phone?.message}>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="off"
                  placeholder="e.g. +1 (555) 010-2000"
                  {...fieldA11y("phone")}
                  {...register("phone")}
                />
              </FormField>
              <FormField
                id="location"
                label="Location"
                error={errors.location?.message}
              >
                <Input
                  id="location"
                  autoComplete="off"
                  placeholder="e.g. Boston, MA"
                  {...fieldA11y("location")}
                  {...register("location")}
                />
              </FormField>
              <FormField
                id="bio"
                label="Bio"
                error={errors.bio?.message}
                hint={`${bioLength}/${BIO_MAX} characters`}
                className="sm:col-span-2"
              >
                <Textarea
                  id="bio"
                  className="min-h-[96px]"
                  maxLength={BIO_MAX}
                  placeholder="A short note about your practice areas."
                  {...fieldA11y("bio")}
                  {...register("bio")}
                />
              </FormField>
            </div>

            <div className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              Your email address and role are managed by your administrator.
            </div>

            {save.isError ? (
              <p
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {save.error.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !hasChanges}>
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
