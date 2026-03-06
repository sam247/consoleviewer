"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function useAuthStatus() {
  return useQuery({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      if (!res.ok) return { gscConnected: false, bingConnected: false };
      return res.json() as Promise<{ gscConnected: boolean; bingConnected: boolean }>;
    },
  });
}

export function HeaderIntegrations() {
  const { data } = useAuthStatus();
  const gscConnected = data?.gscConnected ?? false;
  const bingConnected = data?.bingConnected ?? false;

  return (
    <div className="flex items-center gap-1" aria-label="Data sources">
      <Link
        href="/settings"
        className={cn(
          "flex h-9 min-w-[2.25rem] items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors",
          gscConnected
            ? "border-border bg-accent/80 text-foreground"
            : "border-border bg-muted/30 text-muted-foreground"
        )}
        title={gscConnected ? "Google Search Console connected" : "Connect GSC in Settings"}
      >
        GSC
      </Link>
      <Link
        href="/settings"
        className={cn(
          "flex h-9 min-w-[2.25rem] items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors",
          bingConnected
            ? "border-border bg-accent/80 text-foreground"
            : "border-border bg-muted/30 text-muted-foreground"
        )}
        title={bingConnected ? "Bing Webmaster connected" : "Connect Bing in Settings"}
      >
        Bing
      </Link>
    </div>
  );
}
