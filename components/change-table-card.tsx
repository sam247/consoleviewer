"use client";

import Link from "next/link";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { TableCard } from "@/components/ui/table-card";
import {
  TABLE_BASE_CLASS,
  TABLE_CELL_Y,
  TABLE_HEAD_CLASS,
  TABLE_ROW_CLASS,
} from "@/components/ui/table-styles";

type ChangeRow = {
  label: string;
  clicks: number;
  changePercent?: number;
  title?: string;
};

function formatSignedPercent(value?: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const v = Math.round(value);
  const arrow = v > 0 ? "↑" : v < 0 ? "↓" : "→";
  return `${arrow} ${v >= 0 ? "+" : ""}${v}%`;
}

export function ChangeTableCard({
  title,
  variant,
  rows,
  viewMoreHref,
  className,
}: {
  title: string;
  variant: "rising" | "dropping";
  rows: ChangeRow[];
  viewMoreHref: string;
  className?: string;
}) {
  const limited = useMemo(() => rows.slice(0, 8), [rows]);
  const color = variant === "rising" ? "text-positive" : "text-negative";

  return (
    <TableCard
      title={<span className="text-sm font-semibold text-foreground">{title}</span>}
      action={
        <Link href={viewMoreHref} className="text-xs text-muted-foreground hover:text-foreground underline" aria-label={`View more for ${title}`}>
          View more
        </Link>
      }
      className={cn("min-w-0", className)}
    >
      <div className="overflow-x-auto">
        <table className={TABLE_BASE_CLASS}>
          <thead className={TABLE_HEAD_CLASS}>
            <tr>
              <th className={cn("px-5 font-semibold text-left w-[60%]", TABLE_CELL_Y)}>Name</th>
              <th className={cn("px-5 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Clicks</th>
              <th className={cn("px-5 font-semibold text-right w-[20%]", TABLE_CELL_Y)}>Chg</th>
            </tr>
          </thead>
          <tbody>
            {limited.length > 0 ? (
              limited.map((r) => (
                <tr key={r.label} className={TABLE_ROW_CLASS}>
                  <td className={cn("px-5 truncate min-w-0 text-foreground", TABLE_CELL_Y)} title={r.title ?? r.label}>
                    {r.label}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums text-muted-foreground", TABLE_CELL_Y)}>
                    {r.clicks.toLocaleString()}
                  </td>
                  <td className={cn("px-5 text-right tabular-nums", TABLE_CELL_Y)}>
                    <span className={cn(color)}>{formatSignedPercent(r.changePercent)}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </TableCard>
  );
}
