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
    label: "Business days (Mon–Fri)",
    options: [
      { value: "bw1", label: "1 business week" },
      { value: "bw2", label: "2 business weeks" },
      { value: "bw4", label: "4 business weeks" },
      { value: "bm1", label: "1 business month" },
      { value: "bm3", label: "3 business months" },
      { value: "bq", label: "Business quarter" },
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
      { value: "fy_uk", label: "FY: UK/India (Apr–Mar)" },
      { value: "fy_us", label: "FY: US Federal (Oct–Sep)" },
      { value: "fy_au", label: "FY: Australia (Jul–Jun)" },
      { value: "fy_jp", label: "FY: Japan (Apr–Mar)" },
      { value: "fy_de", label: "FY: Germany (Jan–Dec)" },
      { value: "lfy_uk", label: "Last FY: UK/India" },
      { value: "lfy_us", label: "Last FY: US Federal" },
      { value: "lfy_au", label: "Last FY: Australia" },
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

const FY_START_MONTH: Record<string, number> = {
  uk: 3, in: 3, jp: 3,   // April (0-indexed 3)
  us: 9,                  // October
  au: 6,                  // July
  de: 0,                  // January (calendar)
};

function financialYearStartForCountry(d: Date, country: string): Date {
  const fyMonth = FY_START_MONTH[country] ?? 3;
  const year = d.getMonth() >= fyMonth ? d.getFullYear() : d.getFullYear() - 1;
  return new Date(year, fyMonth, 1);
}

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function businessDaysAgo(n: number): { start: Date; end: Date } {
  const end = new Date();
  while (!isWeekday(end)) end.setDate(end.getDate() - 1);
  let count = 0;
  const start = new Date(end);
  while (count < n - 1) {
    start.setDate(start.getDate() - 1);
    if (isWeekday(start)) count++;
  }
  return { start, end };
}

/** Returns { start, end } where [start, end] contains exactly n business days and end is the given date (or last weekday on or before it). */
function businessDaysEndingAt(endDate: Date, n: number): { start: Date; end: Date } {
  const end = new Date(endDate);
  while (!isWeekday(end)) end.setDate(end.getDate() - 1);
  let count = 0;
  const start = new Date(end);
  while (count < n - 1) {
    start.setDate(start.getDate() - 1);
    if (isWeekday(start)) count++;
  }
  return { start, end };
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

  const countryFyMatch = rangeKey.match(/^fy_(uk|us|au|in|jp|de)$/);
  if (countryFyMatch) {
    const country = countryFyMatch[1];
    const start = financialYearStartForCountry(now, country);
    const priorFyEnd = new Date(start); priorFyEnd.setDate(priorFyEnd.getDate() - 1);
    const priorFyStart = financialYearStartForCountry(priorFyEnd, country);
    return { startDate: fmt(start), endDate: fmt(now), priorStartDate: fmt(priorFyStart), priorEndDate: fmt(priorFyEnd) };
  }

  const countryLfyMatch = rangeKey.match(/^lfy_(uk|us|au|in|jp|de)$/);
  if (countryLfyMatch) {
    const country = countryLfyMatch[1];
    const thisFyStart = financialYearStartForCountry(now, country);
    const end = new Date(thisFyStart); end.setDate(end.getDate() - 1);
    const start = financialYearStartForCountry(end, country);
    const priorEnd = new Date(start); priorEnd.setDate(priorEnd.getDate() - 1);
    const priorStart = financialYearStartForCountry(priorEnd, country);
    return { startDate: fmt(start), endDate: fmt(end), priorStartDate: fmt(priorStart), priorEndDate: fmt(priorEnd) };
  }

  const businessRanges: Record<string, number> = {
    bw1: 5, bw2: 10, bw4: 20, bm1: 22, bm3: 66, bq: 66,
  };
  if (rangeKey in businessRanges) {
    const n = businessRanges[rangeKey];
    const { start, end } = businessDaysAgo(n);
    const priorEnd = new Date(start);
    priorEnd.setDate(priorEnd.getDate() - 1);
    const { start: priorStart } = businessDaysEndingAt(priorEnd, n);
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
