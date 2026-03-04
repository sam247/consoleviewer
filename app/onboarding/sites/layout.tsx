import { Suspense } from "react";

export default function OnboardingSitesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background">Loading…</div>}>{children}</Suspense>;
}
