# Scorva — Conventions

Behavioral rules for maintaining the codebase.
For system architecture see [docs/ARCHITECTURE.md](ARCHITECTURE.md).

## Generated code
- **Never edit** `backend/src/generated/prisma/` — regenerate with `prisma generate`
- **Prisma** — schema/migrations only; runtime uses `pg` directly

## Security & middleware
- **Security headers** — `helmet` applied in `backend/src/index.js`
- **CORS allowlist** in `backend/src/middleware/index.js` — production only: `scorva.vercel.app` and `scorva.dev`; localhost/LAN allowed when `NODE_ENV !== "production"`
- **Middleware chain order**: `helmet` → `requestLogger` → `cors` → `express.json()` → `webhooksRoute` → `aiSummaryRoute` → `sseConnectionLimiter` (on `/api/live`) → `liveRoute` → `generalLimiter` → all other routes
- **AI route** — stricter `aiLimiter` (inside `routes/aiSummary.js`) + `requireAuth`; never return `error.message` to client on failure — 500 status only
- **Auth middleware** (`requireAuth`) — calls `supabase.auth.getUser(token)` using `SUPABASE_SECRET_KEY` + `SUPABASE_URL`

## Validation rules
- **League validation** — all 8 league-param controllers (teams, standings, games, gameDetail, players, playerDetail, seasons, live) validate against `["nba","nfl","nhl"]` (400 if invalid)
- **Favorites** — controller validates numeric `playerId`/`teamId` (400 for non-numeric); `checkFavorites` uses `Number.isInteger(n) && n > 0` and caps at 50 IDs per array; service uses `ROW_NUMBER()` for 3 most recent per favorite
- **Search input** — term capped at 200 chars; LIKE metacharacters (`%`, `_`, `\`) escaped before building the ILIKE pattern to prevent full-table scans
- **Search deduplication** — `DISTINCT ON (type, id)` in the `deduped` CTE ensures a player matched by both real name and alias appears only once
- **Popularity** — never manually set `players.popularity`; it is derived from `stats` row counts by `refreshPopularity()` after every upsert run; `upsertPlayer.js` ON CONFLICT preserves the value so ingestion doesn't reset it

## Frontend conventions
- **`apiFetch`** (`frontend/src/api/client.js`) — supports `method` + `body` + `timeout` (default 15 000 ms); sets `Content-Type: application/json` when body present; handles 204 responses; uses `AbortSignal.any([callerSignal, AbortSignal.timeout(ms)])` so callers can still cancel
- **`useUserPrefs`** — pass `controller.signal` to `getProfile()` so the AbortController signal is forwarded (not just creating the controller)
- **`game_label`** — display-only text, null for regular season; never use for classification logic
- **`games.type`** — single source of truth for game classification; see [docs/ARCHITECTURE.md](ARCHITECTURE.md)

## Backend conventions
- **`userController`** — delete Supabase auth user *before* DB delete (not after)
- **`gameDetailService` player arrays** — all 6 `json_agg()` subqueries wrapped with `COALESCE(..., '[]'::json)` so games with no stats return `[]` not `null`

## Adding a new endpoint (checklist)
1. `backend/src/routes/myRoute.js` — router + controller delegation only
2. `backend/src/controllers/myController.js` — extract params, call service, handle errors
3. `backend/src/services/myService.js` — SQL query, return data
4. Mount in `backend/src/index.js` under `/api`
5. Test in `backend/__tests__/routes/myRoute.test.js` — mock db with `createMockPool()`
