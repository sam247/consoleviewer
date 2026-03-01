"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useHiddenProjects } from "@/contexts/hidden-projects-context";
import { cn } from "@/lib/utils";

function displayUrl(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) {
    return siteUrl.slice("sc-domain:".length).replace(/\/$/, "");
  }
  return siteUrl.replace(/\/$/, "") || siteUrl;
}

async function fetchSerprobotStatus(): Promise<{ configured: boolean; credits?: number }> {
  const res = await fetch("/api/serprobot?action=credit");
  if (!res.ok) return { configured: false };
  const data = await res.json();
  const credits = data.balance ?? data.credits ?? data.remaining;
  return { configured: Boolean(data.configured), credits: typeof credits === "number" ? credits : undefined };
}

export default function SettingsPage() {
  const { hiddenSet, unhide } = useHiddenProjects();
  const hiddenList = Array.from(hiddenSet);
  const { data: serpStatus } = useQuery({
    queryKey: ["serprobotStatus"],
    queryFn: fetchSerprobotStatus,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background px-6 py-4">
        <Link
          href="/"
          className="text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded"
        >
          Consoleview
        </Link>
      </header>
      <main className="flex-1 p-6 mx-auto max-w-2xl w-full">
        <h1 className="text-xl font-semibold text-foreground mb-6">Settings</h1>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-foreground mb-2">Hidden projects</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Projects you hide are listed here. Unhide to show them again on the dashboard.
          </p>
          {hiddenList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hidden projects.</p>
          ) : (
            <ul className="rounded-lg border border-border bg-surface divide-y divide-border">
              {hiddenList.map((siteUrl) => (
                <li
                  key={siteUrl}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="min-w-0 truncate text-sm text-foreground" title={siteUrl}>
                    {displayUrl(siteUrl)}
                  </span>
                  <button
                    type="button"
                    onClick={() => unhide(siteUrl)}
                    className={cn(
                      "shrink-0 rounded-md border border-input bg-background px-3 py-1.5 text-sm",
                      "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                    )}
                  >
                    Unhide
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-foreground mb-2">SerpRobot (keyword tracking)</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Set <code className="rounded bg-muted px-1">SERPROBOT_API_KEY</code> in your environment to connect. Only <code className="rounded bg-muted px-1">rank_check</code> and <code className="rounded bg-muted px-1">get_serps</code> consume credits.
          </p>
          {serpStatus?.configured ? (
            <p className="text-sm text-muted-foreground">
              API credits: {typeof serpStatus.credits === "number" ? serpStatus.credits : "—"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not configured. Add <code className="rounded bg-muted px-1">SERPROBOT_API_KEY</code> to your environment variables.
            </p>
          )}
        </section>

        <p className="text-sm text-muted-foreground">Profile and account settings will appear here.</p>
      </main>
    </div>
  );
}
