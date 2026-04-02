# Scorva — API & Route Reference

## API endpoints (all under `/api`)
- `GET /:league/teams`
- `GET /:league/standings`
- `GET /:league/games`
- `GET /:league/games/:gameId`
- `GET /:league/players`
- `GET /:league/players/:playerId`
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
- `POST /chat` — **requires auth**; SSE stream; body `{ message, conversationId?, pageContext? }`; emits `delta`, `done`, `error` events; rate-limited by `chatLimiter` (30 req/15 min prod)

## Frontend routes
- `/` → Homepage
- `/about` → About (lazy-loaded)
- `/:league` → LeaguePage
- `/:league/teams/:teamId` → TeamPage
- `/:league/players/:playerId` → PlayerPage
- `/:league/games/:gameId` → GamePage
- `/settings` → SettingsPage (requires auth, redirects to `/` if logged out)
- `/privacy` → PrivacyPage (lazy-loaded)
- `/auth/callback` → AuthCallback (OAuth popup handler — no layout shell)
- `*` → ErrorPage (404 catch-all, lazy-loaded)
