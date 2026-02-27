# Consoleview

Minimal Google Search Console dashboard: overview grid (all sites) and drill-down per site. Data-driven, responsive UI with date range selector and spreadsheet-like feedback.

## Features

- **Overview**: Grid of site cards (3 columns), each with clicks, impressions, % change, and sparkline. Date range selector (7d / 28d / 3m / 6m) and optional search.
- **Drill-down**: Per-site summary metrics, trend chart, and tables for Queries, Pages, Countries, Devices with All / Growing / Decaying filters; Branded vs non-branded breakdown.
- **GSC**: Uses real Search Console API when `GOOGLE_REFRESH_TOKEN` is set; otherwise shows stub data.

## Setup

1. **Env**: Copy `.env.example` to `.env.local`. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (e.g. `https://consoleviewer.vercel.app/api/auth/callback/google`).
2. **Refresh token**: Visit `/api/auth/google`, sign in with the Google account that has Search Console access. On the callback page, copy the refresh token and add it as `GOOGLE_REFRESH_TOKEN` in Vercel (or `.env.local` for local). Redeploy if on Vercel.
3. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Import the project from GitHub in [Vercel](https://vercel.com).
2. Add env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (your production callback URL).
3. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add the callback URL to the OAuth 2.0 client’s authorized redirect URIs.
4. After first deploy, visit `https://your-app.vercel.app/api/auth/google`, sign in, then add the shown refresh token as `GOOGLE_REFRESH_TOKEN` in Vercel and redeploy.
