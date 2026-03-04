"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";

type GCSSite = { siteUrl: string; permissionLevel: string };

function displaySiteUrl(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) {
    return siteUrl.slice("sc-domain:".length).replace(/\/$/, "");
  }
  try {
    const url = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);
    return url.hostname + (url.pathname !== "/" ? url.pathname : "");
  } catch {
    return siteUrl;
  }
}

export default function OnboardingSitesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<GCSSite[] | null>(null);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const urlError = searchParams.get("error");

  const fetchSites = useCallback(async () => {
    setLoading(true);
    setSitesError(null);
    try {
      const res = await fetch("/api/gsc/sites");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 404) {
        const data = await res.json().catch(() => ({}));
        setSitesError(data.code === "gsc_not_connected" ? "Connect Google Search Console to see your sites." : "GSC not connected");
        setSites(null);
        return;
      }
      if (!res.ok) {
        setSitesError("Failed to load sites");
        setSites(null);
        return;
      }
      const data = (await res.json()) as GCSSite[];
      setSites(data);
    } catch {
      setSitesError("Failed to load sites");
      setSites(null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const toggle = (siteUrl: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(siteUrl)) next.delete(siteUrl);
      else next.add(siteUrl);
      return next;
    });
  };

  const selectAll = () => {
    if (!sites?.length) return;
    setSelected(new Set(sites.map((s) => s.siteUrl)));
  };

  const handleImport = async () => {
    if (selected.size === 0) {
      setImportError("Select at least one site");
      return;
    }
    setImportError(null);
    setImporting(true);
    try {
      const res = await fetch("/api/gsc/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sites: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError((data as { error?: string }).error ?? "Import failed");
        return;
      }
      router.push("/sites");
      router.refresh();
    } catch {
      setImportError("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-semibold text-foreground">Connect Search Console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Google account and choose which sites to import.
        </p>

        {urlError && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {urlError === "no_refresh_token" && (
              <p>Google did not return a refresh token. Try revoking app access at{" "}
                <a href="https://myaccount.google.com/permissions" className="underline" target="_blank" rel="noreferrer">Google permissions</a> and connect again.
              </p>
            )}
            {urlError !== "no_refresh_token" && <p>Error: {decodeURIComponent(urlError)}</p>}
          </div>
        )}

        {loading && (
          <p className="mt-6 text-sm text-muted-foreground">Loading sites…</p>
        )}

        {!loading && sitesError && (
          <div className="mt-6 rounded-lg border border-border bg-surface p-6">
            <p className="text-sm text-muted-foreground">{sitesError}</p>
            <a
              href="/api/google/connect"
              className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Connect Google Search Console
            </a>
          </div>
        )}

        {!loading && sites && sites.length > 0 && (
          <div className="mt-6 rounded-lg border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Select sites to import</span>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Select all
              </button>
            </div>
            <ul className="divide-y divide-border">
              {sites.map((site) => (
                <li key={site.siteUrl} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
                  <input
                    type="checkbox"
                    id={site.siteUrl}
                    checked={selected.has(site.siteUrl)}
                    onChange={() => toggle(site.siteUrl)}
                    className="rounded border-input"
                  />
                  <label htmlFor={site.siteUrl} className="flex-1 text-sm text-foreground cursor-pointer">
                    {displaySiteUrl(site.siteUrl)}
                  </label>
                  {site.permissionLevel && (
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {site.permissionLevel.replace(/^site/, "")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {selected.size} of {sites.length} selected. Only these sites will appear in Your sites; re-importing replaces your list.
              </p>
              <div className="flex items-center justify-between gap-4">
                {importError && <p className="text-sm text-red-600 dark:text-red-400">{importError}</p>}
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || selected.size === 0}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
                >
                  {importing ? "Importing…" : "Import selected"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && sites && sites.length === 0 && !sitesError && (
          <p className="mt-6 text-sm text-muted-foreground">No Search Console properties found for this account.</p>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/" className="underline hover:no-underline">Back to dashboard</Link>
        </p>
      </main>
    </div>
  );
}
