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
import type { AiPanelScope } from "@/contexts/ai-panel-context";

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
        <div className="mx-auto max-w-[86rem] overflow-x-hidden rounded-lg border border-border bg-surface px-4 py-3 shadow-sm md:px-6">
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
              <DateRangeSelect />
              <ProfileMenu />
            </div>
          </div>

          <div className="md:hidden">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/"
                className="shrink-0 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
              >
                Consoleview
              </Link>
              <div className="flex items-center gap-2">
                <ProfileMenu />
                <MobileOverflowMenu
                  buttonLabel="Dashboard controls"
                  panelClassName="right-0"
                >
                  <div className="flex flex-col gap-2">
                    {showSearch && onSearchChange && (
                      <div className="p-1">
                        <OverviewSearch
                          value={searchValue}
                          onChange={onSearchChange}
                          placeholder="Search"
                        />
                      </div>
                    )}
                    <div className="p-1">
                      <DateRangeSelect />
                    </div>
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
              </div>
            </div>
            <div className="mt-3 flex justify-center overflow-x-auto pb-1">
              <div className="min-w-0 shrink-0">
                <SparkToggles />
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
