"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Header } from "@/components/header";
import { encodePropertyId } from "@/types/gsc";

type Property = { id: string; site_url: string; gsc_site_url: string | null };

function displaySiteUrl(siteUrl: string): string {
  try {
    const url = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`);
    return url.hostname + (url.pathname !== "/" ? url.pathname : "");
  } catch {
    return siteUrl;
  }
}

export default function SitesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["team-properties"],
    queryFn: async () => {
      const res = await fetch("/api/properties");
      if (res.status === 401) return { properties: [] as Property[] };
      if (!res.ok) throw new Error("Failed to load properties");
      return res.json() as Promise<{ properties: Property[] }>;
    },
  });

  const properties = data?.properties ?? [];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-[86rem]">
          <h1 className="text-xl font-semibold text-foreground">Your sites</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a site to view Search Console data.
          </p>

          {isLoading && (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          )}

          {error && (
            <p className="mt-6 text-sm text-red-600 dark:text-red-400">Failed to load sites.</p>
          )}

          {!isLoading && !error && properties.length > 0 && (
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {properties.map((p) => {
                const gscUrl = p.gsc_site_url || p.site_url;
                const propertyId = encodePropertyId(gscUrl);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/sites/${propertyId}`}
                      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-foreground/20 hover:bg-muted/30"
                    >
                      <span className="font-medium text-foreground">{displaySiteUrl(p.site_url)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {!isLoading && !error && properties.length === 0 && (
            <div className="mt-6 rounded-lg border border-border bg-surface p-6 text-center">
              <p className="text-sm text-muted-foreground">No sites imported yet.</p>
              <Link
                href="/onboarding/sites"
                className="mt-3 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                Connect Search Console and import sites
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
