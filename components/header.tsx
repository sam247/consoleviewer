"use client";

import Link from "next/link";
import { DateRangeSelect } from "./date-range-select";
import { OverviewSearch } from "./overview-search";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  sortSelect?: React.ReactNode;
}

export function Header({
  searchValue = "",
  onSearchChange,
  showSearch = false,
  sortSelect,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background px-4 py-3">
      <Link
        href="/"
        className="text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
      >
        Consoleview
      </Link>
      <div className="flex items-center gap-3 md:gap-4">
        {showSearch && onSearchChange && (
          <OverviewSearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Q Search"
          />
        )}
        {sortSelect}
        <ThemeToggle />
        <a
          href="/api/auth/google"
          className="text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
        >
          Sign in
        </a>
        <a
          href="/api/auth/app-logout"
          className="text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
        >
          Log out
        </a>
        <DateRangeSelect />
      </div>
    </header>
  );
}
