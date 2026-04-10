"use client";

const W = 60;
const H = 16;
const PAD = 1;

function getStroke(values: number[]): "positive" | "negative" | "neutral" {
  if (values.length < 2) return "neutral";
  const first = values.find((v) => Number.isFinite(v)) ?? 0;
  const last = values.slice().reverse().find((v) => Number.isFinite(v)) ?? 0;
  if (last > first) return "positive";
  if (last < first) return "negative";
  return "neutral";
}

export function MetricSparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stroke = getStroke(values);
  const color =
    stroke === "positive"
      ? "var(--positive)"
      : stroke === "negative"
        ? "var(--negative)"
        : "var(--muted-foreground)";

  const points = values.map((p, i) => {
    const x = PAD + (i / Math.max(1, values.length - 1)) * (W - 2 * PAD);
    const y = H - PAD - ((p - min) / range) * (H - 2 * PAD);
    return `${x},${y}`;
  });
  const d = points.length > 1 ? `M ${points.join(" L ")}` : "";

  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden>
      {d ? (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      ) : null}
    </svg>
  );
}

