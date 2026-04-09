"use client";

import { cn } from "@/lib/utils";
import { displaySiteUrl, faviconDomain } from "@/lib/site-url";

export function SiteIdentity({
  siteUrl,
  className,
  faviconSize = 20,
  textClassName,
}: {
  siteUrl: string;
  className?: string;
  faviconSize?: number;
  textClassName?: string;
}) {
  const domain = faviconDomain(siteUrl);
  const label = displaySiteUrl(siteUrl);

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
        alt=""
        width={faviconSize}
        height={faviconSize}
        className="shrink-0 rounded"
      />
      <span className={cn("min-w-0 truncate", textClassName)}>
        {label}
      </span>
    </div>
  );
}
