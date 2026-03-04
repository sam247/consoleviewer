"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /sites now redirects to the home page which shows
 * the full Project View with SiteCard sparklines.
 */
export default function SitesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
