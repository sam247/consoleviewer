"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useBlur } from "@/contexts/blur-context";

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { blurEnabled, toggleBlur } = useBlur();

  const { data: authStatus } = useQuery({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      if (!res.ok) return { signedIn: false, gscConnected: false, avatarUrl: null };
      return res.json() as Promise<{ signedIn: boolean; gscConnected: boolean; avatarUrl: string | null }>;
    },
  });

  const signedIn = authStatus?.signedIn ?? false;
  const avatarUrl = authStatus?.avatarUrl ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-accent text-sm font-medium text-foreground",
          "hover:bg-accent/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Profile and settings"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user profile image
          <img
            src={avatarUrl}
            alt=""
            width={36}
            height={36}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground" aria-hidden>?</span>
        )}
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full z-30 mt-2 min-w-[180px] rounded-md border border-border bg-surface py-1 shadow-lg"
          role="menu"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center justify-between gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent"
              onClick={(e) => {
                e.preventDefault();
                toggleBlur();
              }}
            >
              <span>Blur</span>
              <span className="text-xs text-muted-foreground">{blurEnabled ? "On" : "Off"}</span>
            </button>
          </li>
          {!signedIn ? (
            <li role="none">
              <a
                href="/api/auth/google"
                role="menuitem"
                className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                Sign in
              </a>
            </li>
          ) : (
            <>
              <li role="none">
                <Link
                  href="/settings"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  Settings
                </Link>
              </li>
              <li role="none">
                <a
                  href="/api/auth/app-logout"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  Sign out
                </a>
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}
