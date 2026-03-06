"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { DateRangeProvider } from "@/contexts/date-range-context";
import { HiddenProjectsProvider } from "@/contexts/hidden-projects-context";
import { PinnedProjectsProvider } from "@/contexts/pinned-projects-context";
import { SparkSeriesProvider } from "@/contexts/spark-series-context";
import { ThemeProvider } from "@/contexts/theme-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DateRangeProvider>
          <HiddenProjectsProvider>
            <PinnedProjectsProvider>
              <SparkSeriesProvider>{children}</SparkSeriesProvider>
            </PinnedProjectsProvider>
          </HiddenProjectsProvider>
        </DateRangeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
