# Scorva — API & Route Reference

## API endpoints (all under `/api`)
- `GET /:league/teams`
- `GET /:league/teams/:teamId/seasons` — distinct seasons the team has played in, ordered DESC
- `GET /:league/standings`
- `GET /:league/games` — optional `?date=YYYY-MM-DD` returns `{ games[], resolvedDate, resolvedSeason }` instead of a flat array; nearest-date fallback when no games exist on the requested date; validates format, 400 on mismatch
- `GET /:league/games/dates` — optional `?season=`; returns `[{ date: "YYYY-MM-DD", count: N }]` for all dates with games in the season (cached 5 min)
- `GET /:league/games/:gameId`
- `GET /:league/games/:gameId/plays` — returns `{ plays[], source }` where `source` is `"db"` (Final, cached 30d), `"espn"` (live, proxied), or `"none"` (scheduled/no eventid)
- `GET /:league/games/:gameId/prediction` — pre-game only; 404 for live/final; returns win probabilities, key factors, confidence (`normal` | `low`); cached 1h
- `GET /:league/games/:eventId/win-probability?final=true|false` — returns `{ winProbability[], scoreMargin[] }`; proxied from ESPN summary; cached 30s (live) / 30d (final, `cacheIf` non-null); key `winprob:v2:{league}:{eventId}`
- `GET /:league/players`
- `GET /:league/players/:playerId`
- `GET /:league/players/:playerId/similar` — returns `{ players: [...] }` (up to 5); position-filtered for NFL/NHL; requires embeddings to be computed; returns `{ players: [] }` if player has < 5 games (< 2 for NFL)
- `GET /:league/seasons`
- `GET /search`
- `GET /live/:league/games` — SSE stream; heartbeat `: ping` every 15s; `event: done` when no live games
- `GET /live/:league/games/:gameId` — SSE stream; `event: done` when game is Final
- `GET /games/:id/ai-summary` — **requires `Authorization: Bearer <token>` header**
- `GET /favorites` — requires auth; returns `{ players: [...], teams: [...] }`
- `GET /favorites/check?playerIds=1,2&teamIds=3,4` — requires auth
- `POST /favorites/players/:playerId` — requires auth
- `DELETE /favorites/players/:playerId` — requires auth
- `POST /favorites/teams/:teamId` — requires auth
- `DELETE /favorites/teams/:teamId` — requires auth
- `GET /user/profile` — requires auth; returns `id`, `email`, `first_name`, `last_name`, `default_league`
- `PATCH /user/profile` — requires auth; body `{ firstName, lastName, defaultLeague }`; validates `defaultLeague` against `["nba", "nfl", "nhl"]`
- `DELETE /user/account` — requires auth; deletes Supabase auth user then DB row (cascades favorites)
- `POST /webhooks/supabase-auth` — verified by `Authorization: <SUPABASE_WEBHOOK_SECRET>`; inserts user on signup
- `POST /chat` — **requires auth**; SSE stream; body `{ message, conversationId?, pageContext? }`; emits `delta`, `status`, `done`, `error` events; rate-limited by `chatLimiter` (30 req/15 min prod)

## Frontend routes
- `/` → Homepage
- `/about` → About (lazy-loaded)
- `/:league` → LeaguePage
- `/:league/teams/:teamId` → TeamPage
- `/:league/players/:playerId` → PlayerPage
- `/:league/games/:gameId` → GamePage
- `/privacy` → PrivacyPage (lazy-loaded)
- `/auth/callback` → AuthCallback (OAuth popup handler — no layout shell)
- `*` → ErrorPage (404 catch-all, lazy-loaded)
