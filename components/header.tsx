"use client";

import Link from "next/link";
import { useState } from "react";
import { DateRangeSelect } from "./date-range-select";
import { OverviewSearch } from "./overview-search";
import { ProfileMenu } from "./profile-menu";
import { ShareModal } from "./share-modal";
import { SparkToggles } from "./spark-toggles";
import { ThemeToggle } from "./theme-toggle";
import { AiHeaderButton } from "./ai-feature-card";
import { MobileOverflowMenu } from "@/components/ui/mobile-overflow-menu";

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
  const shareButton = showShare ? (
    <button
      type="button"
      onClick={() => setShareOpen(true)}
      data-menu-close="true"
      className="flex h-10 items-center rounded-md border border-border px-3 py-0 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      Share
    </button>
  ) : null;

  return (
    <>
      <header className="sticky top-0 z-20 py-4 bg-background">
        <div className="mx-auto max-w-[86rem] rounded-lg border border-border bg-surface px-4 py-3 shadow-sm md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
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
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <div className="hidden md:flex shrink-0 items-center gap-2 md:gap-3 min-h-9 h-9">
                {sortSelect}
                {filterSelect}
                {shareButton}
                <SparkToggles />
                <AiHeaderButton />
                <ThemeToggle />
              </div>
              <div className="md:hidden">
                <MobileOverflowMenu buttonLabel="Dashboard controls">
                  <div className="flex flex-col gap-2">
                    {sortSelect && <div data-menu-close="true">{sortSelect}</div>}
                    {filterSelect && <div data-menu-close="true">{filterSelect}</div>}
                    {shareButton}
                    <div data-menu-close="true"><SparkToggles /></div>
                    <div data-menu-close="true"><AiHeaderButton /></div>
                    <div data-menu-close="true"><ThemeToggle /></div>
                  </div>
                </MobileOverflowMenu>
              </div>
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
