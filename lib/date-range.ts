import type { DateRangeKey } from "@/types/gsc";

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "28d", label: "28 days" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
  { value: "16m", label: "16 months" },
];

function daysForRange(key: DateRangeKey): number {
  switch (key) {
    case "7d":
      return 7;
    case "28d":
      return 28;
    case "3m":
      return 90;
    case "6m":
      return 180;
    case "12m":
      return 365;
    case "16m":
      return 487; // ~16 months
    default:
      return 28;
  }
}

export function getDateRange(rangeKey: DateRangeKey): {
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
} {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysForRange(rangeKey));
  const priorEnd = new Date(start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - daysForRange(rangeKey) + 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    startDate: fmt(start),
    endDate: fmt(end),
    priorStartDate: fmt(priorStart),
    priorEndDate: fmt(priorEnd),
  };
}
