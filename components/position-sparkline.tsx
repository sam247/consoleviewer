"use client";

const W = 60;
const H = 16;
const PAD = 1;

function getStroke(positions: number[]): "positive" | "negative" | "neutral" {
  if (positions.length < 2) return "neutral";
  const first = positions[0];
  const last = positions[positions.length - 1];
  if (last < first) return "positive";
  if (last > first) return "negative";
  return "neutral";
}

export function PositionSparkline({ positions }: { positions: number[] }) {
  if (!positions.length) return null;
  const min = Math.min(...positions);
  const max = Math.max(...positions);
  const range = max - min || 1;
  const stroke = getStroke(positions);
  const color =
    stroke === "positive"
      ? "var(--positive)"
      : stroke === "negative"
        ? "var(--negative)"
        : "var(--muted-foreground)";

  const points = positions.map((p, i) => {
    const x = PAD + (i / Math.max(1, positions.length - 1)) * (W - 2 * PAD);
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
        />
      ) : null}
    </svg>
  );
}
