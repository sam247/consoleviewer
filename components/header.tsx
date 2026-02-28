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
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background px-6 py-4">
      <Link
        href="/"
        className="shrink-0 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
      >
        Consoleview
      </Link>
      <div className="flex flex-1 items-center justify-end gap-4 md:gap-6">
        {showSearch && onSearchChange && (
          <OverviewSearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Q Search"
          />
        )}
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
    </header>
  );
}
