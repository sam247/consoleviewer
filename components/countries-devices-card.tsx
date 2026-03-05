"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { formatNum } from "@/hooks/use-property-data";

type DimensionRow = {
  key: string;
  clicks: number;
  impressions: number;
  changePercent: number;
};

const COUNTRY_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

function countryLabel(code: string): string {
  try {
    const upper = code.toUpperCase();
    if (upper.length === 2) return COUNTRY_NAMES.of(upper) ?? code;
    return code;
  } catch {
    return code;
  }
}

export function CountriesDevicesCard({
  countries,
  devices,
}: {
  countries: DimensionRow[];
  devices: DimensionRow[];
}) {
  const [tab, setTab] = useState<"countries" | "devices">("countries");

  const topCountries = countries.slice(0, 10).map((r) => ({
    name: countryLabel(r.key),
    code: r.key,
    clicks: r.clicks,
    impressions: r.impressions,
    changePercent: r.changePercent,
  }));

  const deviceData = devices.map((r) => ({
    name: r.key.charAt(0).toUpperCase() + r.key.slice(1).toLowerCase(),
    value: r.clicks,
    fullLabel: `${r.key}: ${formatNum(r.clicks)} clicks`,
    changePercent: r.changePercent,
  }));

  const hasCountries = countries.length > 0;
  const hasDevices = devices.length > 0;

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Countries &amp; Devices</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Geographic and device breakdown of your search traffic
          </p>
        </div>
        <div className="flex rounded-md border border-input bg-background p-0.5">
          <button
            type="button"
            onClick={() => setTab("countries")}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              tab === "countries" ? "bg-background text-foreground border border-input" : "text-muted-foreground hover:bg-accent"
            )}
          >
            Countries
          </button>
          <button
            type="button"
            onClick={() => setTab("devices")}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              tab === "devices" ? "bg-background text-foreground border border-input" : "text-muted-foreground hover:bg-accent"
            )}
          >
            Devices
          </button>
        </div>
      </div>
      <div className="p-4 min-h-[240px]">
        {tab === "countries" && (
          <>
            {hasCountries ? (
              <>
                <div className="h-[180px] w-full mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCountries} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={72}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Bar dataKey="clicks" radius={[0, 2, 2, 0]} fill="var(--chart-clicks)" maxBarSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-1.5 pr-2 font-medium">Country</th>
                        <th className="py-1.5 pr-2 font-medium text-right">Clicks</th>
                        <th className="py-1.5 pr-2 font-medium text-right">Impr.</th>
                        <th className="py-1.5 font-medium text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCountries.map((r) => (
                        <tr key={r.code} className="border-b border-border/50">
                          <td className="py-1.5 pr-2 text-foreground">{r.name}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{formatNum(r.clicks)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{formatNum(r.impressions)}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            {r.changePercent !== 0 ? (
                              <span className={r.changePercent > 0 ? "text-positive" : "text-negative"}>
                                {r.changePercent > 0 ? "+" : ""}{r.changePercent}%
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No country data for this period.</p>
            )}
          </>
        )}
        {tab === "devices" && (
          <>
            {hasDevices ? (
              <>
                <div className="h-[160px] w-full mb-4 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deviceData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={64}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {deviceData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={["var(--chart-clicks)", "var(--chart-impressions)", "var(--chart-ctr)"][i % 3]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number | undefined) => [formatNum(value ?? 0), "Clicks"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-1.5 pr-2 font-medium">Device</th>
                        <th className="py-1.5 pr-2 font-medium text-right">Clicks</th>
                        <th className="py-1.5 pr-2 font-medium text-right">Impr.</th>
                        <th className="py-1.5 font-medium text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((r) => (
                        <tr key={r.key} className="border-b border-border/50">
                          <td className="py-1.5 pr-2 text-foreground capitalize">{r.key}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{formatNum(r.clicks)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{formatNum(r.impressions)}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            {r.changePercent !== 0 ? (
                              <span className={r.changePercent > 0 ? "text-positive" : "text-negative"}>
                                {r.changePercent > 0 ? "+" : ""}{r.changePercent}%
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No device data for this period.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
