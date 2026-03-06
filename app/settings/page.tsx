"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { cn } from "@/lib/utils";

const AVATAR_MAX_PX = 256;
const AVATAR_JPEG_QUALITY = 0.85;
const AVATAR_MAX_BYTES = 350_000; // Keep request body under 1MB with name/email

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const scale = Math.min(1, AVATAR_MAX_PX / Math.max(w, h));
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      let dataUrl = canvas.toDataURL("image/jpeg", AVATAR_JPEG_QUALITY);
      if (dataUrl.length > AVATAR_MAX_BYTES) {
        dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

interface UserProfile {
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

function useProfile() {
  return useQuery<UserProfile>({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json();
    },
  });
}

function useAuthStatus() {
  return useQuery({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      if (!res.ok) return { signedIn: false, gscConnected: false, avatarUrl: null };
      return res.json() as Promise<{ signedIn: boolean; gscConnected: boolean; avatarUrl: string | null }>;
    },
  });
}

function ProfileSection() {
  const { data: profile, isLoading } = useProfile();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.displayName);
      setEmail(profile.email);
      setAvatarPreview(profile.avatarUrl);
      setAvatarDataUrl(profile.avatarUrl);
    }
  }, [profile]);

  const [saveError, setSaveError] = useState<string | null>(null);
  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveError(null);
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          email,
          avatarUrl: avatarDataUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Save failed");
    },
    onSuccess: () => {
      setDirty(false);
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.invalidateQueries({ queryKey: ["authStatus"] });
    },
    onError: (err) => {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be under 2 MB");
      return;
    }
    resizeImageToDataUrl(file)
      .then((dataUrl) => {
        setAvatarPreview(dataUrl);
        setAvatarDataUrl(dataUrl);
        setDirty(true);
      })
      .catch(() => alert("Could not process image. Try a different file."));
  }, []);

  const handleRemoveAvatar = useCallback(() => {
    setAvatarPreview(null);
    setAvatarDataUrl(null);
    setDirty(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  if (isLoading) {
    return <div className="animate-pulse h-32 rounded-lg bg-accent" />;
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-foreground mb-4">Profile</h2>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-accent",
              "hover:border-foreground/40 transition-colors cursor-pointer"
            )}
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">Upload</span>
            )}
          </button>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-foreground">Profile picture</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                {avatarPreview ? "Change" : "Upload"}
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="text-xs text-muted-foreground hover:text-destructive underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div>
          <label htmlFor="profile-name" className="block text-sm text-foreground mb-1">
            Name
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Your name"
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="block text-sm text-foreground mb-1">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setDirty(true); }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="button"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            dirty
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-accent text-muted-foreground cursor-not-allowed"
          )}
        >
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </button>
        {saveMutation.isSuccess && !dirty && (
          <span className="ml-3 text-sm text-green-600">Saved</span>
        )}
        {saveError && (
          <span className="ml-3 text-sm text-destructive">{saveError}</span>
        )}
      </div>
    </section>
  );
}

function GscConnectionSection() {
  const { data: authStatus } = useAuthStatus();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  const gscConnected = authStatus?.gscConnected ?? false;

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/gsc/disconnect", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["authStatus"] });
        router.refresh();
      }
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <section>
      <h2 className="text-sm font-medium text-foreground mb-2">Google Search Console</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {gscConnected
          ? "Your account is connected to Google Search Console."
          : "Connect your Google Search Console account to import sites and data."}
      </p>
      {gscConnected ? (
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className={cn(
            "rounded-md border border-input bg-background px-4 py-2 text-sm font-medium",
            "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
            "disabled:opacity-50"
          )}
        >
          {disconnecting ? "Disconnecting…" : "Disconnect GSC"}
        </button>
      ) : (
        <a
          href="/api/google/connect"
          className={cn(
            "inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background",
            "hover:bg-foreground/90 transition-colors"
          )}
        >
          Connect Google Search Console
        </a>
      )}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-[86rem]">
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-foreground">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your profile and integrations. Site visibility is handled in{" "}
              <Link href="/onboarding/sites" className="underline hover:no-underline">
                Manage or add sites
              </Link>.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-lg border border-border bg-surface p-5">
              <ProfileSection />
            </div>
            <div className="rounded-lg border border-border bg-surface p-5">
              <GscConnectionSection />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
