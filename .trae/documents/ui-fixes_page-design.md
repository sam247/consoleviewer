# Page Design Spec — Card chart height + mobile header controls

## Global Styles (applies to dashboard)
- Layout system: Desktop-first CSS Grid for main page sections; Flexbox for header control row; avoid fixed heights for chart containers.
- Spacing: Use consistent horizontal padding (desktop: 24px; mobile: 16px). Vertical section spacing 16–24px.
- Typography: Use existing app scale; control labels should truncate with ellipsis instead of wrapping.
- Controls:
  - Primary buttons: 36–40px height desktop, 40–44px height mobile.
  - Touch targets: minimum 44x44px on mobile.
  - Hover/focus: standard app focus ring; toggles show clear selected state.
- Color tokens: Use existing Tailwind tokens/CSS variables; no new hardcoded colors.

## Meta Information
- Title: Site Dashboard
- Description: Performance overview with configurable date range and filters.
- Open Graph: Use existing defaults (no changes required).

---

## Page: Site Dashboard

### Page Structure (desktop-first)
- Top: Header region with page title/context and control area.
- Main: Section stack (cards and charts) in responsive grids.

### Section A — Header Controls (Desktop)
- Layout: Two-row allowed on desktop if needed; prioritize clarity over compression.
- Components:
  1. Page context (property/site name)
  2. Date range control (button with current range)
  3. Filter/toggle controls (existing toggles)
- Behavior:
  - Controls remain stable (no layout shift) while data loads.

### Section A — Header Controls (Mobile: one-line control bar)
- Goal: All “fast access” controls fit on one line at small widths.
- Layout:
  - Single horizontal Flex row with `gap` and `min-width: 0` children.
  - If needed, allow horizontal scrolling *within* the control row (not page) for secondary items, while keeping core items visible.
  - Suggested structure (left-to-right):
    1. Date Range Pill (always visible)
    2. Primary Toggle Group (always visible)
    3. More (overflow) button (always visible)
- Components (mobile):
  1. Date Range Pill Button
     - Shows compact label (e.g., “Last 28d”) with chevron.
     - Tap opens Date Range Picker as bottom sheet.
  2. Primary Toggle Group
     - Segmented control or icon+label chips for the 1–3 most-used toggles.
     - One-tap toggling; selected state visually prominent.
     - Labels truncate (no wrapping). Prefer icons on very narrow screens.
  3. More Button
     - Opens bottom sheet (preferred) or popover listing secondary toggles/filters.
     - Shows count badge if any non-default filters active (optional, only if already supported).
- Interaction rules:
  - Opening date picker or “More” must not push content; use overlay/bottom sheet.
  - Persist selections across open/close; apply immediately or via explicit “Apply” (match existing behavior).

### Section B — Card Charts (Fix height clipping)
- Problem statement: Some card charts appear visually clipped vertically (top/bottom cut off) when container height, overflow, or chart sizing mismatches.
- Layout rules:
  - Chart container must not rely on a hardcoded height that can become smaller than chart content.
  - Prefer: `width: 100%` + `min-height` (per chart type) + auto height based on content.
  - Ensure outer card content areas allow the chart to render fully:
    - Avoid `overflow: hidden` on parents unless intentional; if used for rounded corners, apply it at a wrapper that still includes required chart padding.
    - Include internal padding to prevent axis labels/legends from touching edges.
- Responsive behavior:
  - Chart re-measures on:
    - viewport resize/orientation change
    - sidebar/collapsible layout changes
    - data load that changes axis label sizes
- Loading/empty states:
  - While loading: reserve the same min-height as the final chart to prevent jump.
  - Empty: keep min-height and show empty-state message centered.

### Acceptance Criteria (UI)
1. On iPhone-sized widths, header controls remain a single line; date range and primary toggles are reachable without opening a secondary screen.
2. Secondary controls remain accessible via “More” without breaking the one-line rule.
3. No chart is clipped at top/bottom across common breakpoints (mobile, tablet, desktop) and during loading-to-render transitions.
4. Desktop layout and section composition remain visually unchanged aside from the clipping fix.
