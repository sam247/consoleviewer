# Consoleview — Agent Guide

Rules for AI agents making changes to this codebase.

## Architecture

The project view page (`app/sites/[propertyId]/page.tsx`) is a **~190-line composition file**. It imports a data hook and section components — it does NOT contain card logic, layout grids, or local state beyond cross-section concerns.

```
app/sites/[propertyId]/page.tsx   ← composition only (~190 lines)
├── hooks/use-property-data.ts    ← all data fetching, queries, memos
├── components/sections/          ← each section owns its own grid + state
│   ├── overview-section.tsx
│   ├── trend-section.tsx
│   ├── insights-section.tsx
│   ├── volatility-branded-section.tsx
│   ├── opportunity-section.tsx
│   ├── index-cannibalisation-section.tsx
│   ├── performance-tables-section.tsx
│   └── add-metric-section.tsx
└── components/                   ← individual card components
    ├── tracked-keywords-section.tsx
    ├── position-volatility-chart.tsx
    ├── query-footprint.tsx
    ├── ai-query-signals-card.tsx
    ├── cannibalisation-card.tsx
    ├── index-signals-card.tsx
    └── ...
```

## Rules for making changes

### Modifying a card (e.g. tracked-keywords, query-footprint)

Edit the card's own component file in `components/`. Do NOT touch:
- `app/sites/[propertyId]/page.tsx`
- Any file in `components/sections/`
- `hooks/use-property-data.ts`

A card change should never alter the page layout.

### Modifying a section layout (e.g. which cards appear in a grid row)

Edit the relevant file in `components/sections/`. Do NOT touch:
- `app/sites/[propertyId]/page.tsx` (unless adding/removing an entire section)
- Other section files
- Card component files

### Adding a new card to an existing section

1. Create the card component in `components/`.
2. Import it in the relevant `components/sections/` file.
3. Add it to that section's JSX.

### Adding a new section

1. Create a new section file in `components/sections/`.
2. Import it in `app/sites/[propertyId]/page.tsx`.
3. Add a single `<NewSection ... />` element in the composition stack.

### Changing data fetching or derived data

Edit `hooks/use-property-data.ts`. Add new fields to the return type. Do NOT inline fetch calls or data transformations in page or section files.

## Conventions

- **Functional components only.** No class components.
- **No hardcoded values** — use CSS variables and Tailwind tokens.
- **Keep files focused.** A component file should do one thing. If it exceeds ~300 lines, consider splitting.
- **localStorage keys** use the pattern `consoleview_<feature>_<scope>` (e.g. `consoleview_branded_terms_<propertyId>`).
- **Types** are exported from the file that defines them (e.g. `Summary` from `hooks/use-property-data.ts`, `BandFilter` from `components/query-footprint.tsx`).

## Database

- **Neon Postgres** via pooled connection (`NEON_DATABASE_URL`).
- Migrations live in `db/migrations/` as numbered SQL files.
- Run migrations via the Neon MCP or directly on the Neon console.
- Keep queries lean — no `SELECT *`, no unnecessary joins.

## Do NOT

- Add large dependencies without justification.
- Commit `.env` or credential files.
- Modify the page composition file for card-level changes.
- Create mock/sample data files — the app uses live GSC + Neon data.
- Add inline components inside page files — extract them to their own file.
