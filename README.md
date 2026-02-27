# Consoleview

Minimal Google Search Console dashboard: overview grid (all sites) and drill-down per site. Data-driven, responsive UI with date range selector and spreadsheet-like feedback.

## Features

- **Overview**: Grid of site cards (3 columns), each with clicks, impressions, % change, and sparkline. Date range selector (7d / 28d / 3m / 6m) and optional search.
- **Drill-down**: Per-site summary metrics, trend chart, and tables for Queries, Pages, Countries, Devices with All / Growing / Decaying filters; Branded vs non-branded breakdown.
- **API**: Stub data only. Wire GSC by adding credentials and replacing `lib/gsc.ts` with real `sites.list` and `searchanalytics.query` calls.

## Setup

```bash
npm install
cp .env.example .env.local
# Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI when ready
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Push to GitHub and import the project in [Vercel](https://vercel.com).
2. Add environment variables in the Vercel dashboard (same as `.env.example`).
3. In Google Cloud Console, add your production URL to OAuth redirect URIs (e.g. `https://your-app.vercel.app/api/auth/callback/google`).

## GSC API (when ready)

- Enable [Search Console API](https://console.cloud.google.com/apis/library/webmasters.googleapis.com) and create OAuth 2.0 credentials.
- Scope: `https://www.googleapis.com/auth/webmasters.readonly`.
- Implement OAuth callback in `app/api/auth/[...nextauth]/route.ts` (or use NextAuth) and use the token in `lib/gsc.ts` to call `sites.list` and `searchanalytics.query`.
