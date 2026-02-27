import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        accent: "var(--accent)",
        ring: "var(--ring)",
        positive: "var(--positive)",
        negative: "var(--negative)",
        neutral: "var(--neutral)",
        "chart-clicks": "var(--chart-clicks)",
        "chart-impressions": "var(--chart-impressions)",
      },
    },
  },
  plugins: [],
};
export default config;
