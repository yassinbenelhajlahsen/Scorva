# AGENTS.MD

## Scope
This repository is a full-stack JavaScript project with:
- Frontend in `frontend/` (React + Vite + Tailwind CSS v4).
- Backend in `backend/` (Express + PostgreSQL + Jest).

## Architecture

### Backend request flow
```
Route (routes/) → Controller (controllers/) → Service (services/) → DB (db/db.js)
```
- **Routes**: one file per resource; only delegates to the controller function — no logic.
- **Controllers**: extracts `req.params` / `req.query`, calls service, sends `res.json()` or `res.status(500)`.
- **Services**: runs raw SQL via `pg` Pool, returns plain data. Business logic lives here.
- **Prisma** is used for schema management and migrations **only** — runtime queries use `pg` directly.

### Frontend structure
- Entry: `frontend/src/main.jsx`
- HTML template: `frontend/index.html`
- Router: `frontend/src/App.jsx`
- `api/` — thin fetch wrappers: client.js (apiFetch with auth/body/204 support), games.js, teams.js, players.js, search.js, seasons.js, ai.js, favorites.js, user.js
- `hooks/` — data-fetching hooks: useGame, useTeam, usePlayer, useLeagueData, useHomeGames, useSearch, useSeasons, useAISummary, useFavorites, useFavoriteToggle, useUserPrefs, useLiveGame, useLiveGames
- `pages/` — route-level components: Homepage, LeaguePage, TeamPage, PlayerPage, GamePage, SettingsPage, About, PrivacyPage, ErrorPage, LoadingPage, AuthCallback
- `components/layout/` — Navbar (gear icon → /settings when logged in), Footer, PageWrapper, ScrollToTop
- `components/cards/` — GameCard, StatCard, TopPerformerCard, PlayerAvgCard
- `components/settings/` — FavoritesTab (favorites list + default league picker), AccountTab (name/password/delete)
- `components/ui/` — SearchBar, SeasonSelector, AISummary, BoxScore, AuthModal, PasswordChecklist, FloatingInput (TSX), Skeleton, ErrorState
- `utilities/` — Normalize.js, formatDate.js, slugify.js, topPlayers.js, LeagueData.js, motion.js
- Styles: `frontend/src/index.css` — Tailwind v4 CSS-based config via `@theme` (no `tailwind.config.js`)

## Frontend Routes
```
/                           → Homepage (defers league tabs until user prefs resolve)
/about                      → About
/settings                   → SettingsPage (requires auth, redirects to / if logged out)
/privacy                    → PrivacyPage
/:league                    → LeaguePage
/:league/teams/:teamId      → TeamPage
/:league/players/:playerId  → PlayerPage
/:league/games/:gameId      → GamePage
/auth/callback              → AuthCallback (OAuth popup handler — no layout shell)
*                           → ErrorPage
```

## Backend Routers (all mounted under `/api`)
| Route | Router file |
|---|---|
| `GET /:league/teams` | routes/teams.js |
| `GET /:league/standings` | routes/standings.js |
| `GET /:league/games` | routes/games.js |
| `GET /:league/games/:gameId` | routes/gameInfo.js |
| `GET /:league/players` | routes/players.js |
| `GET /:league/players/:playerId` | routes/playerInfo.js |
| `GET /:league/seasons` | routes/seasons.js |
| `GET /search` | routes/search.js |
| `GET /games/:id/ai-summary` | routes/aiSummary.js |
| `GET /favorites` | routes/favorites.js |
| `GET /favorites/check` | routes/favorites.js |
| `POST /favorites/players/:id` | routes/favorites.js |
| `DELETE /favorites/players/:id` | routes/favorites.js |
| `POST /favorites/teams/:id` | routes/favorites.js |
| `DELETE /favorites/teams/:id` | routes/favorites.js |
| `GET /user/profile` | routes/user.js |
| `PATCH /user/profile` | routes/user.js |
| `DELETE /user/account` | routes/user.js |
| `POST /webhooks/supabase-auth` | routes/webhooks.js |

## Database Models (Prisma schema at `backend/prisma/schema.prisma`)
- **games**: id, league, date, hometeamid, awayteamid, homescore, awayscore, season, status, venue, broadcast, winnerid, ai_summary, game_label, period scores (firstqtr–fourthqtr, ot1–ot4), eventid
- **teams**: id, name, shortname, league, location, logo_url, record, homerecord, awayrecord, conf, espnid
- **players**: id, name, league, teamid, position, height, weight, jerseynum, dob, draftinfo, image_url, espn_playerid
- **stats**: composite PK (gameid, playerid); sport-specific columns covering NBA/NFL/NHL stats
- **users**: id (UUID, PK — matches Supabase auth.users.id), created_at, email, first_name, last_name, default_league VARCHAR(10)
- **user_favorite_players**: composite PK (user_id, player_id); FK to users + players
- **user_favorite_teams**: composite PK (user_id, team_id); FK to users + teams

`game_label` is set for playoff games (e.g. `"NBA Finals - Game 1"`). Null for regular season.
`default_league` stores the user's preferred homepage league (`"nba"`, `"nfl"`, or `"nhl"`). Null defaults to `"nba"` on the frontend.
Generated client lives at `backend/src/generated/prisma/` — never edit directly; re-run `prisma generate` after schema changes.

## Verified Commands
### Frontend (`frontend/package.json`)
- `cd frontend && npm run dev` → `vite` (dev server)
- `cd frontend && npm run build` → `vite build`
- `cd frontend && npm run lint` → `eslint .`
- `cd frontend && npm run preview` → `vite preview`

### Backend (`backend/package.json`)
- `cd backend && npm run start` → `node src/index.js`
- `cd backend && npm test` → `NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js`
- `cd backend && npm run test:watch` → same Jest command with `--watch`
- `cd backend && npm run test:coverage` → same Jest command with `--coverage`

### Ingestion / maintenance
- `node backend/src/populate/upsert.js`
- `node backend/src/populate/historicalUpsert.js`

### Prisma
- `cd backend && node_modules/.bin/prisma generate` — regenerate client after schema changes
- `cd backend && node_modules/.bin/prisma migrate dev --name <desc>` — apply schema change locally
- `cd backend && node_modules/.bin/prisma migrate deploy` — apply migrations on production
- `cd backend && node_modules/.bin/prisma migrate status` — check migration state

## Environment
- Frontend env example: `frontend/.env.example`
  - `VITE_API_URL=http://localhost:3000`
- Backend env example: `backend/.env.example`
  - `DATABASE_URL=...`
  - `OPENAI_API_KEY=...`
- Backend env loading: `backend/src/config/env.js`

## Constraints and Gotchas
- Frontend API base URL is always `VITE_API_URL`; all fetch calls use the `api/client.js` wrapper.
- Vite dev proxy target is hardcoded to `http://192.168.1.68:3000` in `frontend/vite.config.js`.
- Backend CORS is allowlist-based (`backend/src/middleware/index.js`): `localhost:5173–5175`, `192.168.1.68:5173–5175`, and `https://scorva.dev`. Update `corsOrigins` for new origins.
- Rate limiting (`backend/src/middleware/index.js`):
  - General limiter on all `/api` routes.
  - Stricter `aiLimiter` for AI summary route (mounted first in `index.js`).
  - Webhook route is mounted before all limiters — no rate limiting on `/api/webhooks/supabase-auth`.
- AI summaries are cache-first and persisted to `games.ai_summary`; generation only triggers for games with a `Final` status.
- `playerInfo` uses `getCurrentSeason(league)` from `cache/seasons.js` for season resolution.
- Backend server starts listening directly in `backend/src/index.js` (no exported app instance for tests — tests create their own Express app).
- All imports must use `.js` extensions (both packages use ESM `"type": "module"`).
- Prisma shadow DB requires `pg_trgm` extension; `prisma migrate dev` may fail locally — apply SQL manually then `prisma migrate resolve --applied`.
- **Users table** stores `id`, `email`, `first_name`, `last_name`, `default_league`. Populated two ways: (1) Supabase webhook `POST /api/webhooks/supabase-auth` on signup — email/password users pass name via `options.data`, Google OAuth users split `full_name`; (2) `ensureUser()` in `favoritesService.js` as fallback. Both use `ON CONFLICT DO UPDATE` with `COALESCE` — never overwrites existing values.
- **User preferences** (`default_league`): fetched via `useUserPrefs` hook. Homepage `activeLeague` starts as `null` and only renders tabs once resolved — prevents NBA flash. Settings page updates via `PATCH /api/user/profile`. `updateUser` service uses COALESCE so omitted fields are unchanged.
- **Settings page** (`/settings`): sidebar (desktop) / drill-down (mobile). FavoritesTab: add/remove favorites + default league picker (spring-animated sliding indicator, optimistic local state). AccountTab: edit name, change password (validates current password via `signInWithPassword`), delete account (type "DELETE" to confirm). Sign out in sidebar below tabs on desktop, at bottom of menu list on mobile.
- **Account deletion**: `DELETE /api/user/account` → `supabaseAdmin.auth.admin.deleteUser()` first → then `userService.deleteUser()` (cascades favorites). Uses `SUPABASE_SECRET_KEY` env var (same key as auth middleware).
- **Google OAuth detection**: use `user.app_metadata.providers.includes("email")` — not the single `provider` string. Password section hidden for OAuth users; "Signed in with Google" badge shown.
- **Auth modal**: fully centered all screen sizes (`items-center`), outside-click dismissible, `max-h-[90dvh]` scrollable, close button always visible.
- **apiFetch** supports `method` + `body` params; sets `Content-Type: application/json` when body present; handles 204 no-content.
- **Favorites routes** all require `requireAuth` at the router level in `routes/favorites.js`. User routes require `requireAuth` in `routes/user.js`.
- When mocking auth routes in tests, mock `requireAuth` to call `next()` and set `req.user = { id: "test-uuid" }`.

## Testing
- Jest config: `backend/jest.config.js`
- Tests live in `backend/__tests__/` organized by category:
  - `routes/` — Supertest route tests for all endpoints
  - `services/` — Service unit tests
  - `populate/` — Upsert and mapping unit tests
  - `db/` — Database connection tests
  - `integration/` — Full app integration tests
  - `helpers/testHelpers.js` — `createMockPool()`, `fixtures`, `mockRequest`, `mockResponse`
- Mock DB pattern: `jest.unstable_mockModule("../../src/db/db.js", () => ({ default: mockPool }))` before importing.
- Tests run with `NODE_ENV=test` and a mock `DATABASE_URL`.

## Adding a New Backend Endpoint
1. Create `backend/src/routes/myRoute.js` — `router.get(path, myController)` only.
2. Create `backend/src/controllers/myController.js` — extract params, call service, send response, handle errors.
3. Create `backend/src/services/myService.js` — SQL via `pool.query()`, return data.
4. Mount in `backend/src/index.js`: `app.use("/api", generalLimiter, myRoute)`.
5. Write tests in `backend/__tests__/routes/myRoute.test.js` — mock `db/db.js` with `createMockPool()`.

## Agent Workflow Guidance
- Install dependencies per package root: `cd frontend && npm install` / `cd backend && npm install`.
- Run frontend and backend in separate terminals for local dev.
- Validate all backend changes by running `cd backend && npm test` before finishing.
- When modifying the Prisma schema, always run `prisma generate` afterward.
- Tailwind v4: all token customization goes in `frontend/src/index.css` under `@theme` — never create a `tailwind.config.js`.

## Design System (frontend)
Custom tokens defined in `frontend/src/index.css` `@theme`:
- Surfaces: `surface-base` (#0a0a0c), `surface-primary` (#111114), `surface-elevated` (#1a1a1f), `surface-overlay` (#222228)
- Text: `text-primary` (#f5f5f7), `text-secondary` (#a1a1a6), `text-tertiary` (#6e6e73)
- Accent: `accent` (#e8863a), `accent-hover` (#f0974d)
- Semantic: `win` (#34c759), `loss` (#ff453a), `live` (#ff453a)

Core patterns:
- Card: `bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)]`
- Card hover: `hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5` (never `hover:scale-105`)
- Transitions: `transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]`
- Animations: Framer Motion stagger `0.06s`, items `y: 12→0`
- Navbar: sticky, `bg-[rgba(10,10,12,0.88)] backdrop-blur-2xl border-b border-white/[0.06]`
- Content max-width: `max-w-[1200px] mx-auto`
