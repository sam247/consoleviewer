"use client";

import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Status", href: "#" },
  { label: "Docs", href: "/docs" },
  { label: "API", href: "/api" },
  { label: "Changelog", href: "#" },
  { label: "Privacy", href: "#" },
  { label: "Contact", href: "#" },
];

const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-auto py-4 px-4 md:px-6">
      <div className="mx-auto max-w-[86rem] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {FOOTER_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="hover:text-foreground transition-colors duration-150"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <span className="tabular-nums">v{version}</span>
          <span className="text-muted-foreground/80">·</span>
          <span>Built for founders &amp; lean teams</span>
        </div>
      </div>
    </footer>
  );
}
