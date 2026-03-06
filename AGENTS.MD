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
- `api/` — thin fetch wrappers (one file per resource: client.js, games.js, teams.js, players.js, search.js, seasons.js, ai.js)
- `hooks/` — data-fetching hooks (useGame, useTeam, usePlayer, useLeagueData, useHomeGames, useSearch, useSeasons, useAISummary)
- `pages/` — route-level components (Homepage, LeaguePage, TeamPage, PlayerPage, GamePage, About, ErrorPage, LoadingPage)
- `components/layout/` — Navbar, Footer, PageWrapper, ScrollToTop
- `components/cards/` — GameCard, TeamCard, PlayerCard, StatCard, TopPerformerCard, PlayerAvgCard
- `components/ui/` — SearchBar, SeasonSelector, AISummary, BoxScore
- `utilities/` — Normalize.js, formatDate.js, slugify.js, topPlayers.js, LeagueData.js, motion.js
- Styles: `frontend/src/index.css` — Tailwind v4 CSS-based config via `@theme` (no `tailwind.config.js`)

## Frontend Routes
```
/                           → Homepage
/about                      → About
/:league                    → LeaguePage
/:league/teams/:teamId      → TeamPage
/:league/players/:playerId  → PlayerPage
/:league/games/:gameId      → GamePage
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
| `POST /:league/games/:gameId/ai-summary` | routes/aiSummary.js |

## Database Models (Prisma schema at `backend/prisma/schema.prisma`)
- **games**: id, league, date, hometeamid, awayteamid, homescore, awayscore, season, status, venue, broadcast, winnerid, ai_summary, game_label, period scores (firstqtr–fourthqtr, ot1–ot4), eventid
- **teams**: id, name, shortname, league, location, logo_url, record, homerecord, awayrecord, conf, espnid
- **players**: id, name, league, teamid, position, height, weight, jerseynum, dob, draftinfo, image_url, espn_playerid
- **stats**: composite PK (gameid, playerid); sport-specific columns covering NBA/NFL/NHL stats

`game_label` is set for playoff games (e.g. `"NBA Finals - Game 1"`). Null for regular season.
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
- Backend env example: `backend/backend.env.example`
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
- AI summaries are cache-first and persisted to `games.ai_summary`; generation only triggers for games with a `Final` status.
- `playerInfo` uses a hardcoded `currentSeason = "2025-26"` constant.
- Backend server starts listening directly in `backend/src/index.js` (no exported app instance for tests — tests create their own Express app).
- All imports must use `.js` extensions (both packages use ESM `"type": "module"`).
- Prisma shadow DB requires `pg_trgm` extension; `prisma migrate dev` may fail locally — apply SQL manually then `prisma migrate resolve --applied`.

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
- Semantic: `win` (#34c759), `loss` (#ff453a), `live` (#ff9f0a)

Core patterns:
- Card: `bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)]`
- Card hover: `hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5` (never `hover:scale-105`)
- Transitions: `transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]`
- Animations: Framer Motion stagger `0.06s`, items `y: 12→0`
- Navbar: sticky, `bg-[rgba(10,10,12,0.88)] backdrop-blur-2xl border-b border-white/[0.06]`
- Content max-width: `max-w-[1200px] mx-auto`
