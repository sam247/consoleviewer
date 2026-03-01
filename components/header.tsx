"use client";

import Link from "next/link";
import { useState } from "react";
import { DateRangeSelect } from "./date-range-select";
import { OverviewSearch } from "./overview-search";
import { ProfileMenu } from "./profile-menu";
import { ShareModal } from "./share-modal";
import { SparkToggles } from "./spark-toggles";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  sortSelect?: React.ReactNode;
  filterSelect?: React.ReactNode;
  /** When set, show Share button. scopeId required when scope is "project". */
  shareScope?: "dashboard" | "project";
  shareScopeId?: string;
  shareParams?: Record<string, unknown>;
}

export function Header({
  searchValue = "",
  onSearchChange,
  showSearch = false,
  sortSelect,
  filterSelect,
  shareScope,
  shareScopeId,
  shareParams,
}: HeaderProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const showShare = shareScope != null;

  return (
    <>
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
              {showShare && (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  Share
                </button>
              )}
              <div className="flex items-center justify-center">
                <SparkToggles />
              </div>
              <ThemeToggle />
              <DateRangeSelect />
              <ProfileMenu />
            </div>
          </div>
        </div>
      </header>
      {showShare && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          scope={shareScope ?? "dashboard"}
          scopeId={shareScopeId}
          params={shareParams}
        />
      )}
    </>
  );
}
