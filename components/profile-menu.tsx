"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
          "flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-sm font-medium text-foreground",
          "hover:bg-accent/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
      >
        ?
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full z-30 mt-2 min-w-[160px] rounded-md border border-border bg-surface py-1 shadow-lg"
          role="menu"
        >
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
              Log out
            </a>
          </li>
        </ul>
      )}
    </div>
  );
}
