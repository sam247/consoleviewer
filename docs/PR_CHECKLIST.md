# PR checklist — SerpRobot + Three Feature Skeletons

Use this in your PR description when merging.

## Magic link
- [ ] “Share” in dashboard and project header → Create link → copy URL; open `/s/{token}` in incognito to see read-only view. Expiry shown in footer.

## Watchlist
- [ ] Project page → “Index signals” card → “Add URL to watchlist” → modal with suggestions and paste; table shows signals. “Open in GSC” per row.

## Cannibalisation
- [ ] Project page → “Cannibalisation” card → table of conflicts; click row for drawer with URLs and primary suggestion.

## Stubbed vs real
| Area | Stubbed when | Real when |
|------|--------------|-----------|
| SerpRobot | `SERPROBOT_API_KEY` unset | Key set; Tracked Keywords use API |
| Cannibalisation | GSC query+page fails or no data | API returns pairs and conflicts |
| Share links | Supabase env unset (503 on POST) | DB configured |
| Index watchlist | Supabase env unset (empty list) | DB configured |
| Index signals | GSC or Supabase unavailable | Both configured; signals from GSC + watchlist |
| `index_signals_daily` | Not implemented (skeleton) | Future: optional table for cached signals |
