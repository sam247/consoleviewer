"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { useHiddenProjects } from "@/contexts/hidden-projects-context";
import { cn } from "@/lib/utils";

type SiteEntry = { siteUrl: string; permissionLevel: string };

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
  const [source, setSource] = useState<"gsc" | "bing">("gsc");
  const [sites, setSites] = useState<SiteEntry[] | null>(null);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const urlError = searchParams.get("error");
  const { hiddenSet, unhide } = useHiddenProjects();
  const hiddenList = Array.from(hiddenSet);

  const { data: authStatus } = useQuery({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      if (!res.ok) return { gscConnected: false, bingConnected: false };
      return res.json() as Promise<{ gscConnected: boolean; bingConnected: boolean }>;
    },
  });
  const gscConnected = authStatus?.gscConnected ?? false;
  const bingConnected = authStatus?.bingConnected ?? false;

  const fetchSites = useCallback(async () => {
    setLoading(true);
    setSitesError(null);
    try {
      const api = source === "bing" ? "/api/bing/sites" : "/api/gsc/sites";
      const res = await fetch(api);
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 404) {
        const data = await res.json().catch(() => ({}));
        if (source === "bing") {
          setSitesError(data.code === "bing_not_connected" ? "Connect Bing Webmaster in Settings to see your sites." : "Bing not connected");
        } else {
          setSitesError(data.code === "gsc_not_connected" ? "Connect Google Search Console to see your sites." : "GSC not connected");
        }
        setSites(null);
        return;
      }
      if (!res.ok) {
        setSitesError("Failed to load sites");
        setSites(null);
        return;
      }
      const data = (await res.json()) as SiteEntry[];
      setSites(data);
    } catch {
      setSitesError("Failed to load sites");
      setSites(null);
    } finally {
      setLoading(false);
    }
  }, [router, source]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  useEffect(() => {
    setSelected(new Set());
  }, [source]);

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
      const importApi = source === "bing" ? "/api/bing/import" : "/api/gsc/import";
      const res = await fetch(importApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sites: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError((data as { error?: string }).error ?? "Import failed");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setImportError("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Header />
      <main className="flex-1 p-4 md:p-6 max-w-[86rem] mx-auto w-full">
        <h1 className="text-xl font-semibold text-foreground">
          {source === "bing" ? "Bing Webmaster sites" : "Connect Search Console"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import Google Search Console and Bing Webmaster data to compare search performance across search engines.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {source === "bing"
            ? "Import sites from your connected Bing Webmaster account."
            : "Connect your Google account and choose which sites to import."}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium">Sources connected</span>
          <span className={gscConnected ? "text-foreground" : ""}>{gscConnected ? "✓" : "○"} Google Search Console</span>
          <span className={bingConnected ? "text-foreground" : ""}>{bingConnected ? "✓" : "○"} Bing Webmaster</span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Source:</span>
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setSource("gsc")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                source === "gsc"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              GSC
            </button>
            <button
              type="button"
              onClick={() => setSource("bing")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                source === "bing"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Bing
            </button>
          </div>
          {source === "gsc" && gscConnected && (
            <span className="text-xs text-muted-foreground">Connected</span>
          )}
          {source === "bing" && bingConnected && (
            <span className="text-xs text-muted-foreground">Connected</span>
          )}
        </div>

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
            {source === "bing" ? (
              <a
                href="/api/bing/connect"
                className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Connect Bing Webmaster
              </a>
            ) : (
              <a
                href="/api/google/connect"
                className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Connect Google Search Console
              </a>
            )}
          </div>
        )}

        {!loading && sites && sites.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-foreground">Select sites to import</span>
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Select all
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sites.map((site) => {
                const isSelected = selected.has(site.siteUrl);
                return (
                  <label
                    key={site.siteUrl}
                    className="flex flex-col rounded-lg border border-border bg-surface p-4 cursor-pointer hover:bg-muted/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(site.siteUrl)}
                        className="mt-0.5 rounded border-input shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span
                          className="text-sm font-medium text-foreground truncate block"
                          title={site.siteUrl}
                        >
                          {displaySiteUrl(site.siteUrl)}
                        </span>
                        {site.permissionLevel && (
                          <span className="text-[10px] text-muted-foreground uppercase mt-0.5 block">
                            {site.permissionLevel.replace(/^site/, "")}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-6 border-t border-border pt-4 flex flex-col gap-2">
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
          <p className="mt-6 text-sm text-muted-foreground">
            {source === "bing" ? "No Bing Webmaster sites found for this account." : "No Search Console properties found for this account."}
          </p>
        )}

        <section className="mt-8 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-foreground mb-2">Hidden projects</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Hidden sites are managed here. Unhide a project to show it again on your dashboard.
          </p>
          {hiddenList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hidden projects.</p>
          ) : (
            <ul className="rounded-lg border border-border bg-background divide-y divide-border">
              {hiddenList.map((siteUrl) => (
                <li key={siteUrl} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="min-w-0 truncate text-sm text-foreground" title={siteUrl}>
                    {displaySiteUrl(siteUrl)}
                  </span>
                  <button
                    type="button"
                    onClick={() => unhide(siteUrl)}
                    className="shrink-0 rounded-md border border-input bg-surface px-3 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  >
                    Unhide
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-6 text-sm text-muted-foreground">
          <Link href="/" className="underline hover:no-underline">Back to dashboard</Link>
        </p>
      </main>
    </div>
  );
}
