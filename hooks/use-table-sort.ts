"use client";

import { useCallback, useState } from "react";

const TEXT_COLUMNS = new Set(["key", "query", "url", "keyword", "name"]);

export function useTableSort<K extends string>(defaultKey: K, defaultDir: "asc" | "desc" = "desc") {
  const [sortKey, setSortKey] = useState<K>(defaultKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultDir);

  const onSort = useCallback((key: K) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir(TEXT_COLUMNS.has(key) ? "asc" : "desc");
      return key;
    });
  }, []);

  return { sortKey, sortDir, onSort } as const;
}
