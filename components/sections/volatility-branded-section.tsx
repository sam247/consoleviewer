"use client";

import { useEffect, useMemo, useState } from "react";
import { PositionVolatilityChart } from "@/components/position-volatility-chart";
import { BrandedChart } from "@/components/branded-chart";
import type { PropertyData, DailyRow } from "@/hooks/use-property-data";
import { CHART_CARD_MIN_H } from "@/components/ui/chart-frame";

export function VolatilityBrandedSection({
  data,
  daily,
  propertyId,
}: {
  data: PropertyData;
  daily: DailyRow[];
  propertyId: string;
}) {
  const BRANDED_TERMS_KEY = `consoleview_branded_terms_${propertyId}`;
  const [brandedTerms, setBrandedTerms] = useState<string[]>([]);
  const [brandedTermInput, setBrandedTermInput] = useState("");

  useEffect(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(BRANDED_TERMS_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((t) => typeof t === "string")) setBrandedTerms(parsed);
      }
    } catch {
      // ignore
    }
  }, [BRANDED_TERMS_KEY]);

  const addBrandedTerm = () => {
    const t = brandedTermInput.trim().toLowerCase();
    if (!t || brandedTerms.includes(t)) return;
    const next = [...brandedTerms, t];
    setBrandedTerms(next);
    setBrandedTermInput("");
    try { localStorage.setItem(BRANDED_TERMS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const removeBrandedTerm = (term: string) => {
    const next = brandedTerms.filter((x) => x !== term);
    setBrandedTerms(next);
    try { localStorage.setItem(BRANDED_TERMS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const branded = useMemo(() => {
    const totalClicks = data.summary?.clicks ?? 0;
    const terms = brandedTerms.map((t) => t.toLowerCase());
    if (terms.length === 0) {
      return { brandedClicks: 0, nonBrandedClicks: totalClicks };
    }
    let bc = 0;
    for (const q of data.queries) {
      const key = q.key.toLowerCase();
      if (terms.some((t) => key.includes(t))) bc += q.clicks;
    }
    return { brandedClicks: bc, nonBrandedClicks: Math.max(0, totalClicks - bc) };
  }, [brandedTerms, data.queries, data.summary?.clicks]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch min-w-0">
      <PositionVolatilityChart daily={daily} />
      <div className="rounded-lg border border-border bg-surface px-4 py-4 transition-colors flex flex-col min-w-0" style={{ minHeight: CHART_CARD_MIN_H.secondary }}>
        <h2 className="text-sm font-semibold text-foreground mb-2">Branded vs non-branded</h2>
        <p className="text-xs text-muted-foreground mb-1.5">Branded terms (queries containing these count as branded)</p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            type="text"
            value={brandedTermInput}
            onChange={(e) => setBrandedTermInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBrandedTerm())}
            placeholder="e.g. brand name"
            className="rounded border border-border bg-background px-2 py-1 text-sm w-32 focus:ring-2 focus:ring-ring focus:ring-offset-1"
          />
          <button
            type="button"
            onClick={addBrandedTerm}
            className="rounded px-2 py-1 text-xs font-medium bg-background text-foreground border border-input hover:bg-accent transition-colors"
          >
            Add
          </button>
          {brandedTerms.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded bg-muted/70 px-2 py-0.5 text-xs text-foreground"
            >
              {t}
              <button
                type="button"
                onClick={() => removeBrandedTerm(t)}
                className="text-muted-foreground hover:text-foreground focus:ring-2 focus:ring-ring rounded"
                aria-label={`Remove ${t}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex-1 min-h-0 min-w-0">
          <BrandedChart
            brandedClicks={branded.brandedClicks}
            nonBrandedClicks={branded.nonBrandedClicks}
          />
        </div>
      </div>
    </div>
  );
}
