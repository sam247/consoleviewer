"use client";

import Link from "next/link";
import { DateRangeSelect } from "./date-range-select";
import { OverviewSearch } from "./overview-search";
import { ProfileMenu } from "./profile-menu";
import { SparkToggles } from "./spark-toggles";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  sortSelect?: React.ReactNode;
  filterSelect?: React.ReactNode;
}

export function Header({
  searchValue = "",
  onSearchChange,
  showSearch = false,
  sortSelect,
  filterSelect,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 py-4 bg-background">
      <div className="mx-auto max-w-[86rem] rounded-lg border border-border bg-surface px-4 py-3 shadow-sm md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Link
              href="/"
              className="shrink-0 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            >
              Consoleview
            </Link>
            {showSearch && onSearchChange && (
              <OverviewSearch
                value={searchValue}
                onChange={onSearchChange}
                placeholder="Q Search"
              />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-4 md:gap-6">
            {sortSelect}
            {filterSelect}
            <SparkToggles />
            <ThemeToggle />
            <a
              href="/api/auth/google"
              className="text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded whitespace-nowrap"
            >
              Sign in
            </a>
            <ProfileMenu />
            <DateRangeSelect />
          </div>
        </div>
      </div>
    </header>
  );
}
