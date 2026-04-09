"use client";

import Link from "next/link";
import { useState } from "react";
import { DateRangeSelect } from "./date-range-select";
import { OverviewSearch } from "./overview-search";
import { ProfileMenu } from "./profile-menu";
import { ShareModal } from "./share-modal";
import { SparkToggles, SparkTogglesMenu } from "./spark-toggles";
import { ThemeToggle } from "./theme-toggle";
import { AiHeaderButton } from "./ai-feature-card";
import { MobileOverflowMenu } from "@/components/ui/mobile-overflow-menu";
import type { AiPanelScope } from "@/contexts/ai-panel-context";

interface HeaderProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  sortSelect?: React.ReactNode;
  filterSelect?: React.ReactNode;
  showDateRangeSelect?: boolean;
  /** When set, show Share button. scopeId required when scope is "project". */
  shareScope?: "dashboard" | "project";
  shareScopeId?: string;
  shareParams?: Record<string, unknown>;
  aiScope?: AiPanelScope;
  aiPropertyId?: string;
  aiSiteUrl?: string;
}

export function Header({
  searchValue = "",
  onSearchChange,
  showSearch = false,
  sortSelect,
  filterSelect,
  showDateRangeSelect = true,
  shareScope,
  shareScopeId,
  shareParams,
  aiScope,
  aiPropertyId,
  aiSiteUrl,
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
        <div className="mx-auto max-w-[86rem] overflow-visible rounded-lg border border-border bg-surface px-4 py-3 shadow-sm md:px-6">
          <div className="hidden md:flex md:items-center md:justify-between md:gap-4">
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
              <div className="flex shrink-0 items-center gap-2 md:gap-3 min-h-9 h-9">
                {sortSelect}
                {filterSelect}
                {shareButton}
                <SparkToggles />
                {aiScope && (
                  <AiHeaderButton scope={aiScope} propertyId={aiPropertyId} siteUrl={aiSiteUrl} />
                )}
                <ThemeToggle />
              </div>
              {showDateRangeSelect && <DateRangeSelect />}
              <ProfileMenu />
            </div>
          </div>

          <div className="md:hidden">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="min-w-0 flex-1 text-base font-semibold text-foreground truncate focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                Consoleview
              </Link>
              <div className="shrink-0 flex items-center gap-2">
                {showDateRangeSelect && <DateRangeSelect variant="compact" align="right" />}
                <MobileOverflowMenu
                  buttonLabel="Dashboard controls"
                  panelClassName="right-0"
                  buttonClassName="h-11 w-11"
                  buttonIcon={
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
                    </svg>
                  }
                >
                  <div className="flex flex-col gap-2">
                    <div>
                      <SparkTogglesMenu />
                    </div>
                    {showSearch && onSearchChange && (
                      <div className="p-1">
                        <OverviewSearch value={searchValue} onChange={onSearchChange} placeholder="Search" />
                      </div>
                    )}
                    {sortSelect && <div data-menu-close="true">{sortSelect}</div>}
                    {filterSelect && <div data-menu-close="true">{filterSelect}</div>}
                    {shareButton}
                    {aiScope && (
                      <div data-menu-close="true">
                        <AiHeaderButton scope={aiScope} propertyId={aiPropertyId} siteUrl={aiSiteUrl} />
                      </div>
                    )}
                    <div data-menu-close="true"><ThemeToggle /></div>
                  </div>
                </MobileOverflowMenu>
                <div className="shrink-0">
                  <ProfileMenu />
                </div>
              </div>
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
