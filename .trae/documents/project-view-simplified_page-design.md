# Page Design — Simplified Project View + Unified Charts (Desktop-first)

## Global Styles
- Layout system: Flexbox for header/toolbars; CSS Grid for card/table layouts; hybrid with responsive breakpoints.
- Breakpoints: desktop-first; collapse multi-column grids to 1 column on small screens.
- Design tokens (CSS variables): background/surface/foreground/border/accent/ring + chart palette (e.g., `--chart-clicks`, `--chart-impressions`, `--chart-position`).
- Typography: compact dashboard scale (xs/sm for labels, sm/base for primary numbers), tabular-nums for metrics.
- Components: use consistent Card/Frame pattern for all charts and data blocks.

## Shared Chart Styling Contract (applies to every chart)
- Frame: chart lives inside a consistent bordered “chart frame” with title + optional subtitle + actions.
- Plot: consistent padding, min-height, and empty state (“No data…”, “No metrics selected…”) styling.
- Axes: same tick size and muted color; axis lines removed or subtle.
- Grid: dashed horizontal grid, muted opacity.
- Tooltip: same background, border, font size, padding, and shadow.
- Colors: use CSS variables only (no hard-coded hex values).

---

## Page: Login
### Meta Information
- Title: Consoleview — Login
- Description: Sign in to connect performance data sources.

### Page Structure
- Centered single-column panel on `bg-background`.

### Sections & Components
- Login panel: title, short instructions, primary sign-in/connect button(s).
- Error banner: inline error state with retry.

---

## Page: Overview (All Sites)
### Meta Information
- Title: Consoleview — Overview
- Description: All sites overview with trends.

### Page Structure
- Top header/navigation.
- Controls row: date range selector + optional search.
- Content: 3-column grid of site cards on desktop; 1 column on mobile.

### Sections & Components
- Site Card:
  - Domain/title, headline clicks/impressions and deltas.
  - Sparkline chart using the Shared Chart Styling Contract.
  - Click target navigates to Project View.

---

## Page: Project View (Site Detail)
### Meta Information
- Title: Consoleview — Site Detail
- Description: Performance trends, insights, and deep-dive tables for a single site.

### Page Structure (simplified)
- Header: global nav + site context.
- Page container: `max-width` dashboard container with vertical rhythm (`space-y`).
- **Three primary sections** (each visually distinct, fewer headings):
  1) Overview
  2) Performance
  3) Deep Dive

### Sections & Components
#### 1) Overview (top)
- Back link to Overview.
- Site title (truncate) + “data as of” microcopy.
- KPI row (clicks, impressions, CTR, position) + ranking distribution.
- Optional search engine share card remains visually aligned with KPI area.

#### 2) Performance
- Primary Performance chart card (full width on desktop).
  - Title bar: “Performance over time” + controls (range shortcuts, compare-to-previous, % view, export, add annotation).
  - Plot uses Shared Chart Styling Contract (grid/axes/tooltips/margins).
- If query data exists: show Query Footprint next to the chart on desktop (two-column layout); stack below on mobile.

#### 3) Deep Dive
- Responsive grid (2 columns desktop, 1 column mobile) containing:
  - Insights/action cards (AI query signals, tracked keywords, opportunities, movement intelligence).
  - Index signals and cannibalisation cards.
  - Performance tables (Queries + Pages) with existing filters and exports.
  - Page detail panel as an overlay/drawer when selecting a page row.

### Interaction & States
- Loading: skeleton placeholders per section (avoid layout jumps).
- Empty data: inline empty states inside frames (no blank whitespace).
- Consistency: every chart (trend, volatility, branded, sparklines) follows the same frame + plot rules.
