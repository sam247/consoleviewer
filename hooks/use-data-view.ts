"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

export type DataViewDimension = "query" | "page" | "keyword";

export type DataViewRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  clicks_prev: number | null;
  impressions_prev: number | null;
  ctr_prev: number | null;
  position_prev: number | null;
  clicks_change: number | null;
  impressions_change: number | null;
  ctr_change: number | null;
  position_change: number | null;
  clicks_change_percent: number | null;
};

type DataViewResponse = {
  rows: DataViewRow[];
  limit: number;
  offset: number;
  hasPrior: boolean;
};

async function fetchDataViewPage(input: {
  propertyId: string;
  dimension: DataViewDimension;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
  limit: number;
  offset: number;
}): Promise<DataViewResponse> {
  const params = new URLSearchParams({
    dimension: input.dimension,
    startDate: input.startDate,
    endDate: input.endDate,
    priorStartDate: input.priorStartDate,
    priorEndDate: input.priorEndDate,
    limit: String(input.limit),
    offset: String(input.offset),
  });

  const res = await fetch(
    `/api/properties/${encodeURIComponent(input.propertyId)}/data-view?${params}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Failed to load data view");
  }
  return res.json() as Promise<DataViewResponse>;
}

export function useDataViewRows(input: {
  enabled: boolean;
  propertyId: string;
  dimension: DataViewDimension;
  startDate: string;
  endDate: string;
  priorStartDate: string;
  priorEndDate: string;
  pageSize?: number;
}) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 2000, 250), 5000);

  return useInfiniteQuery({
    enabled: input.enabled,
    queryKey: [
      "data-view",
      input.propertyId,
      input.dimension,
      input.startDate,
      input.endDate,
      input.priorStartDate,
      input.priorEndDate,
      pageSize,
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchDataViewPage({
        propertyId: input.propertyId,
        dimension: input.dimension,
        startDate: input.startDate,
        endDate: input.endDate,
        priorStartDate: input.priorStartDate,
        priorEndDate: input.priorEndDate,
        limit: pageSize,
        offset: Number(pageParam) || 0,
      }),
    getNextPageParam: (last) => {
      if (!last.rows || last.rows.length < last.limit) return undefined;
      return last.offset + last.limit;
    },
    staleTime: 60_000,
  });
}

