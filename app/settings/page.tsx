"use client";

import Link from "next/link";

export default function SettingsPage() {
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
        <h1 className="text-xl font-semibold text-foreground mb-4">Settings</h1>
        <p className="text-sm text-muted-foreground">Profile and account settings will appear here.</p>
      </main>
    </div>
  );
}
