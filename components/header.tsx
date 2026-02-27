"use client";

import Link from "next/link";
import { DateRangeSelect } from "./date-range-select";
import { OverviewSearch } from "./overview-search";

interface HeaderProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
}

export function Header({
  searchValue = "",
  onSearchChange,
  showSearch = false,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background px-4 py-3">
      <Link href="/" className="text-lg font-semibold text-foreground">
        Consoleview
      </Link>
      <div className="flex items-center gap-4">
        {showSearch && onSearchChange && (
          <OverviewSearch
            value={searchValue}
            onChange={onSearchChange}
            placeholder="Q Search"
          />
        )}
        <DateRangeSelect />
      </div>
    </header>
  );
}
