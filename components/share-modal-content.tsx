"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type ShareScope = "dashboard" | "project";

const EXPIRY_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

export interface ShareModalContentProps {
  onClose: () => void;
  scope: ShareScope;
  scopeId?: string;
  params?: { [key: string]: unknown };
}

export function ShareModalContent({
  onClose,
  scope: initialScope,
  scopeId,
  params,
}: ShareModalContentProps) {
  const [scope, setScope] = useState<ShareScope>(initialScope);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canSelectProject = scopeId != null;

  const handleCreate = async () => {
    setError(null);
    setCreated(null);
    setLoading(true);
    try {
      const res = await fetch("/api/share-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          scopeId: scope === "project" ? scopeId : undefined,
          params,
          expiresInDays,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create link");
        return;
      }
      setCreated({ url: data.url, expiresAt: data.expiresAt });
    } catch {
      setError("Failed to create link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!created?.url) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  const handleClose = () => {
    setCreated(null);
    setError(null);
    setCopied(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className={cn(
          "w-full max-w-md rounded-lg border border-border bg-surface shadow-lg",
          "px-4 py-4 space-y-4"
        )}
      >
        <div className="flex items-center justify-between">
          <h2 id="share-modal-title" className="text-lg font-semibold text-foreground">
            Share
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            &#215;
          </button>
        </div>

        {!created ? (
          <>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Scope</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScope("dashboard")}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium",
                    scope === "dashboard"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-accent"
                  )}
                >
                  Dashboard
                </button>
                {canSelectProject && (
                  <button
                    type="button"
                    onClick={() => setScope("project")}
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm font-medium",
                      scope === "project"
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-accent"
                    )}
                  >
                    This project
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Expiry</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={loading}
                className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Creating…" : "Create link"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Link created. Expires {new Date(created.expiresAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={created.url}
                className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
