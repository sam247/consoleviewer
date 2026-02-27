"use client";

interface OverviewSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function OverviewSearch({
  value,
  onChange,
  placeholder = "Search sites…",
}: OverviewSearchProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      aria-label="Search sites"
    />
  );
}
