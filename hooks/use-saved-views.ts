"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SavedViewDimension = "query" | "page" | "keyword";

export type SavedView = {
  id: string;
  name: string;
  dimension: SavedViewDimension;
  state: unknown;
  created_at: string;
  updated_at: string;
};

export function useSavedViews({
  propertyId,
  dimension,
  enabled,
}: {
  propertyId: string;
  dimension: SavedViewDimension;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const key = ["saved-views", propertyId, dimension] as const;

  const query = useQuery({
    queryKey: key,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}/saved-views?dimension=${dimension}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null)) as any;
        throw new Error(msg?.error || "Failed to load saved views");
      }
      const data = (await res.json()) as { views: SavedView[] };
      return data.views ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async ({ name, state }: { name: string; state: unknown }) => {
      const res = await fetch(`/api/properties/${propertyId}/saved-views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dimension, state }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null)) as any;
        throw new Error(msg?.error || "Failed to save view");
      }
      const data = (await res.json()) as { view: SavedView };
      return data.view;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/properties/${propertyId}/saved-views/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dimension }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null)) as any;
        throw new Error(msg?.error || "Failed to rename view");
      }
      const data = (await res.json()) as { view: SavedView };
      return data.view;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const remove = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/properties/${propertyId}/saved-views/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null)) as any;
        throw new Error(msg?.error || "Failed to delete view");
      }
      return true;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return { query, create, rename, remove };
}
