/**
 * Build filename for exports: siteSlug_metric_startDate_endDate.ext (caller adds .csv or .png).
 * Example: southyorkshirewindows-co-uk_performance-over-time_2025-01-01_2025-01-31
 */
export function formatExportFilename(
  siteSlug: string,
  metric: string,
  startDate: string,
  endDate: string
): string {
  const slug = siteSlug.replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "site";
  const metricSlug = metric.replace(/\s+/g, "-").toLowerCase();
  return `${slug}_${metricSlug}_${startDate}_${endDate}`;
}

/**
 * Build a CSV string from rows and trigger download. Uses existing column keys.
 */
export function exportToCsv(
  rows: Record<string, string | number | undefined>[],
  filename: string
): void {
  const name = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  if (rows.length === 0) {
    const headers = ["key", "clicks", "impressions", "position", "changePercent"];
    const line = headers.join(",");
    const blob = new Blob([line + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const headers = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r)))
  ).filter((k) => rows[0][k] !== undefined && rows[0][k] !== null);
  const escape = (v: string | number): string => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const line = (r: Record<string, string | number | undefined>) =>
    headers.map((h) => escape(String(r[h] ?? ""))).join(",");
  const csv = [headers.join(","), ...rows.map(line)].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export chart container (element containing an SVG) to PNG. Runs async so UI doesn't block.
 */
export function exportChartToPng(container: HTMLElement | null, filename: string): void {
  if (typeof window === "undefined" || !container) return;
  const svg = container.querySelector("svg");
  if (!svg) return;
  const name = filename.endsWith(".png") ? filename : `${filename}.png`;
  try {
    const serializer = new XMLSerializer();
    const str = serializer.serializeToString(svg);
    const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => {
          if (b) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(b);
            a.download = name;
            a.click();
            URL.revokeObjectURL(a.href);
          }
          URL.revokeObjectURL(url);
        }, "image/png");
      } else URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  } catch {
    // ignore
  }
}
