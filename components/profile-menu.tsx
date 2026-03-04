"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface ProfileMenuProps {
  /** Optional profile image URL (e.g. from session or settings). When set, shown in the trigger. */
  avatarUrl?: string | null;
}

export function ProfileMenu({ avatarUrl }: ProfileMenuProps = {}) {
  const [open, setOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: authStatus } = useQuery({
    queryKey: ["authStatus"],
    queryFn: async () => {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      if (!res.ok) return { signedIn: false, gscConnected: false };
      return res.json() as Promise<{ signedIn: boolean; gscConnected: boolean }>;
    },
  });

  const signedIn = authStatus?.signedIn ?? false;
  const gscConnected = authStatus?.gscConnected ?? false;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDisconnectGsc = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/gsc/disconnect", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: ["authStatus"] });
        router.push("/onboarding/sites");
        router.refresh();
      }
    } finally {
      setDisconnecting(false);
    }
  };

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
          // eslint-disable-next-line @next/next/no-img-element -- user profile image, URL from settings/session
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
              {gscConnected && (
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent disabled:opacity-50"
                    onClick={handleDisconnectGsc}
                    disabled={disconnecting}
                  >
                    {disconnecting ? "Disconnecting…" : "Disconnect GSC"}
                  </button>
                </li>
              )}
              <li role="none">
                <a
                  href="/api/auth/app-logout"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  Sign out of the account
                </a>
              </li>
            </>
          )}
        </ul>
      )}
    </div>
  );
}
