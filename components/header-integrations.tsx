"use client";

import Link from "next/link";

export function HeaderIntegrations() {
  return (
    <Link
      href="/settings"
      className="text-sm text-muted-foreground hover:text-foreground underline"
      title="Manage data sources and settings"
    >
      Manage
    </Link>
  );
}
