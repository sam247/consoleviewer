import type { DateRangeKey } from "@/types/gsc";

export type DateRangeGroup = {
  label: string;
  options: { value: DateRangeKey; label: string }[];
};

export const DATE_RANGE_GROUPS: DateRangeGroup[] = [
  {
    label: "Quick ranges",
    options: [
      { value: "7d", label: "Last 7 days" },
      { value: "28d", label: "Last 28 days" },
      { value: "30d", label: "Last 30 days" },
      { value: "l90d", label: "Last 90 days" },
      { value: "3m", label: "3 months" },
      { value: "6m", label: "6 months" },
      { value: "12m", label: "12 months" },
      { value: "16m", label: "16 months" },
    ],
  },
  {
    label: "Month / Quarter",
    options: [
      { value: "mtd", label: "Month to date" },
      { value: "lm", label: "Last month" },
      { value: "qtd", label: "Quarter to date" },
      { value: "lq", label: "Last quarter" },
    ],
  },
  {
    label: "Year / Financial",
    options: [
      { value: "ytd", label: "Year to date" },
      { value: "fy", label: "Financial year (Apr–Mar)" },
      { value: "lfy", label: "Last financial year" },
    ],
  },
  {
    label: "Custom",
    options: [
      { value: "custom", label: "Custom range" },
    ],
  },
];

export const DATE_RANGE_OPTIONS = DATE_RANGE_GROUPS.flatMap((g) => g.options);

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - n);
  return { start, end };
}

function quarterStart(d: Date): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}

function financialYearStart(d: Date): Date {
  const year = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(year, 3, 1); // Apr 1
}

export function getDateRange(rangeKey: DateRangeKey, customStart?: string, customEnd?: string): {
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
} {
  const now = new Date();

  if (rangeKey === "custom" && customStart && customEnd) {
    const s = new Date(customStart);
    const e = new Date(customEnd);
    const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000));
    const priorEnd = new Date(s);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorStart.getDate() - days + 1);
    return { startDate: customStart, endDate: customEnd, priorStartDate: fmt(priorStart), priorEndDate: fmt(priorEnd) };
  }

  if (rangeKey === "qtd") {
    const start = quarterStart(now);
    const priorEnd = new Date(start); priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = quarterStart(priorEnd);
    return { startDate: fmt(start), endDate: fmt(now), priorStartDate: fmt(priorStart), priorEndDate: fmt(priorEnd) };
  }

  if (rangeKey === "lq") {
    const thisQStart = quarterStart(now);
    const end = new Date(thisQStart); end.setDate(end.getDate() - 1);
    const start = quarterStart(end);
    const priorEnd = new Date(start); priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = quarterStart(priorEnd);
    return { startDate: fmt(start), endDate: fmt(end), priorStartDate: fmt(priorStart), priorEndDate: fmt(priorEnd) };
  }

  if (rangeKey === "mtd") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const priorEnd = new Date(start); priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = new Date(priorEnd.getFullYear(), priorEnd.getMonth(), 1);
    return { startDate: fmt(start), endDate: fmt(now), priorStartDate: fmt(priorStart), priorEndDate: fmt(priorEnd) };
  }

  if (rangeKey === "lm") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const priorEnd = new Date(start); priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = new Date(priorEnd.getFullYear(), priorEnd.getMonth(), 1);
    return { startDate: fmt(start), endDate: fmt(end), priorStartDate: fmt(priorStart), priorEndDate: fmt(priorEnd) };
  }

  if (rangeKey === "ytd") {
    const start = new Date(now.getFullYear(), 0, 1);
    const priorEnd = new Date(start); priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = new Date(priorEnd.getFullYear(), 0, 1);
    return { startDate: fmt(start), endDate: fmt(now), priorStartDate: fmt(priorStart), priorEndDate: fmt(priorEnd) };
  }

  if (rangeKey === "fy") {
    const start = financialYearStart(now);
    const priorFyEnd = new Date(start); priorFyEnd.setDate(priorFyEnd.getDate() - 1);
    const priorFyStart = financialYearStart(priorFyEnd);
    return { startDate: fmt(start), endDate: fmt(now), priorStartDate: fmt(priorFyStart), priorEndDate: fmt(priorFyEnd) };
  }

  if (rangeKey === "lfy") {
    const thisFyStart = financialYearStart(now);
    const end = new Date(thisFyStart); end.setDate(end.getDate() - 1);
    const start = financialYearStart(end);
    const priorEnd = new Date(start); priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = financialYearStart(priorEnd);
    return { startDate: fmt(start), endDate: fmt(end), priorStartDate: fmt(priorStart), priorEndDate: fmt(priorEnd) };
  }

  const DAYS: Record<string, number> = {
    "7d": 7, "28d": 28, "30d": 30, "l90d": 90, "3m": 90, "6m": 180, "12m": 365, "16m": 487,
  };
  const days = DAYS[rangeKey] ?? 28;
  const { start, end } = daysAgo(days);
  const priorEnd = new Date(start); priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd); priorStart.setDate(priorStart.getDate() - days + 1);
  return { startDate: fmt(start), endDate: fmt(end), priorStartDate: fmt(priorStart), priorEndDate: fmt(priorEnd) };
}
