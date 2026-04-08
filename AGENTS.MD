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
- `api/` — thin fetch wrappers: client.js, games.js, teams.js, players.js, search.js, seasons.js, ai.js, favorites.js, user.js, chat.js, plays.js, news.js
- `hooks/` — data-fetching and state hooks organized by domain:
  - `hooks/ai/` — useAISummary, useChatActions
  - `hooks/data/` — useGame, useGameDates, useGamePageData, useHomeGames, useLeagueData, useNews, usePlayer, usePlays, usePrediction, useSearch, useSeasons, useSimilarPlayers, useTeam, useWinProbability
  - `hooks/live/` — useLiveGame, useLiveGames
  - `hooks/user/` — useFavorites, useFavoriteToggle, useUserPrefs
- `lib/` — supabase.js (Supabase client singleton), queryClient.js (TanStack Query client), query.js (query keys + prefetch functions)
- `pages/` — route-level components: Homepage, LeaguePage, TeamPage, PlayerPage, GamePage, About, PrivacyPage, ErrorPage, LoadingPage, AuthCallback
- `context/` — AuthContext (session state + auth modal), ChatContext (chat panel state), SettingsContext (settings drawer state), FavoritesPanelContext (favorites overlay panel state)
- `components/layout/` — Navbar, AvatarDropdown, Footer, PageWrapper, ScrollToTop
- `components/cards/` — GameCard, StatCard, TopPerformerCard, PlayerAvgCard, PredictionCard, SimilarPlayersCard
- `components/auth/` — AuthModal, PasswordChecklist
- `components/chat/` — ChatFAB, ChatInput, ChatMessages, ChatPanel, ChatTypingIndicator, MessageBubble
- `components/game/` — GameMatchupHeader, GameInfoCard, GameTabBar, OverviewTab, AnalysisTab, PlaysTab
- `components/favorites/` — FavoritesPanel, FavoritePlayersSection, FavoriteTeamsSection
- `components/news/` — NewsSection, NewsCard, NewsPreviewModal
- `components/settings/` — SettingsDrawer, FavoritesTab, AccountTab
- `components/navigation/` — MonthNavigation, SeasonSelector
- `components/skeletons/` — GameCardSkeleton, GamePageSkeleton, LeaguePageSkeleton, NewsCardSkeleton, PlayerPageSkeleton, StatCardSkeleton, TeamPageSkeleton
- `components/ui/` — SearchBar, AISummary, BoxScore, FloatingInput, Skeleton, ErrorState, DateNavigation, DateStrip, CalendarPopup, GameChart, PlayByPlay
- `components/` — ErrorBoundary (top-level)
- `utils/` — formatDate.js, leagueData.js, motion.js, normalize.js, relativeTime.js, slugify.js, topPlayers.js
- Styles: `frontend/src/index.css` — Tailwind v4 CSS-based config via `@theme` (no `tailwind.config.js`)

## Frontend Routes

```
/                           → Homepage (defers league tabs until user prefs resolve)
/about                      → About
/privacy                    → PrivacyPage
/:league                    → LeaguePage
/:league/teams/:teamId      → TeamPage
/:league/players/:playerId  → PlayerPage
/:league/games/:gameId      → GamePage
/auth/callback              → AuthCallback (OAuth popup handler — no layout shell)
*                           → ErrorPage
```

Settings is a slide-in drawer opened from the navbar avatar dropdown (not a route/page).

## Backend Routers (all mounted under `/api`)

| Route                                         | Router file              |
| --------------------------------------------- | ------------------------ |
| `GET /:league/teams`                          | routes/teams.js          |
| `GET /:league/teams/:teamId/seasons`          | routes/teams.js          |
| `GET /:league/standings`                      | routes/standings.js      |
| `GET /:league/games`                          | routes/games.js          |
| `GET /:league/games/dates`                    | routes/games.js          |
| `GET /:league/games/:gameId`                  | routes/gameDetail.js     |
| `GET /:league/games/:gameId/plays`            | routes/plays.js          |
| `GET /:league/games/:gameId/prediction`       | routes/prediction.js     |
| `GET /:league/games/:eventId/win-probability` | routes/gameDetail.js     |
| `GET /:league/players`                        | routes/players.js        |
| `GET /:league/players/:slug`                  | routes/playerDetail.js   |
| `GET /:league/players/:slug/similar`          | routes/similarPlayers.js |
| `GET /:league/seasons`                        | routes/seasons.js        |
| `GET /search`                                 | routes/search.js         |
| `GET /news`                                   | routes/news.js           |
| `GET /games/:id/ai-summary`                   | routes/aiSummary.js      |
| `POST /chat`                                  | routes/chat.js           |
| `GET /favorites`                              | routes/favorites.js      |
| `GET /favorites/check`                        | routes/favorites.js      |
| `POST /favorites/players/:id`                 | routes/favorites.js      |
| `DELETE /favorites/players/:id`               | routes/favorites.js      |
| `POST /favorites/teams/:id`                   | routes/favorites.js      |
| `DELETE /favorites/teams/:id`                 | routes/favorites.js      |
| `GET /user/profile`                           | routes/user.js           |
| `PATCH /user/profile`                         | routes/user.js           |
| `DELETE /user/account`                        | routes/user.js           |
| `POST /webhooks/supabase-auth`                | routes/webhooks.js       |
| `GET /:league/head-to-head`                   | routes/headToHead.js     |
| `GET /live/:league/games`                     | routes/live.js           |
| `GET /live/:league/games/:gameId`             | routes/live.js           |

## Database Models (Prisma schema at `backend/prisma/schema.prisma`)

- **games**: id, league, date, hometeamid, awayteamid, homescore, awayscore, season, status, venue, broadcast, winnerid, ai_summary, game_label, period scores (firstqtr–fourthqtr, ot1–ot4), eventid, current_period (Int?), clock (String?), start_time (String?), type (String, default 'regular')
- **teams**: id, name, shortname, league, location, logo_url, record, homerecord, awayrecord, conf, espnid, primary_color (String? VarChar(7))
- **players**: id, name, league, teamid, position, height, weight, jerseynum, dob, draftinfo, image_url, espn_playerid, popularity (Int, default 0)
- **stats**: composite PK (gameid, playerid); sport-specific columns covering NBA/NFL/NHL stats; teamid (Int?, FK to teams — records team at game time)
- **plays**: id, gameid (FK games), espn_play_id, sequence, period, clock, description, short_text, home_score, away_score, scoring_play, team_id (FK teams), play_type, drive_number, drive_description, drive_result; unique(gameid, sequence)
- **player_aliases**: id, player_id (FK players), alias; unique(player_id, alias); GIN trigram index on alias
- **player_stat_embeddings**: id, player_id (FK players), league, season, embedding (vector(14)), games_used, updated_at; unique(player_id, league, season)
- **users**: id (UUID, PK — matches Supabase auth.users.id), created_at, email, first_name, last_name, default_league VARCHAR(10)
- **user_favorite_players**: composite PK (user_id, player_id); FK to users + players
- **user_favorite_teams**: composite PK (user_id, team_id); FK to users + teams
- **chat_conversations**: id (UUID PK), user_id (UUID FK users, cascade delete), summary (String?), summarized_up_to (Int, default 0), created_at, updated_at
- **chat_messages**: id (Int PK), conversation_id (UUID FK chat_conversations, cascade delete), role (String), content (String), page_context (JSONB?), created_at; index(conversation_id, created_at)
- **game_embeddings**: id (Int PK), game_id (Int unique FK games, cascade delete), content (String), embedding (vector(1536)), created_at

`game_label` is set for playoff games (e.g. `"NBA Finals - Game 1"`). Null for regular season.
`default_league` stores the user's preferred homepage league (`"nba"`, `"nfl"`, or `"nhl"`). Null defaults to `"nba"` on the frontend.
Generated client lives at `backend/src/generated/prisma/` — never edit directly; re-run `prisma generate` after schema changes.

## Verified Commands

### Frontend (`frontend/package.json`)

- `cd frontend && npm run dev` → `vite` (dev server)
- `cd frontend && npm run build` → `vite build`
- `cd frontend && npm run lint` → `eslint .`
- `cd frontend && npm run preview` → `vite preview`
- `cd frontend && npm test` → `vitest run`
- `cd frontend && npm run test:watch` → `vitest`
- `cd frontend && npm run test:coverage` → `vitest run --coverage`
- `cd frontend && npm run verify` → `npm run lint && npm test && npm run build`

### Backend (`backend/package.json`)

- `cd backend && npm run start` → `node src/index.js`
- `cd backend && npm run dev` → `nodemon src/index.js | pino-pretty`
- `cd backend && npm run lint` → `eslint src/`
- `cd backend && npm run verify` → `npm run lint && npm test`
- `cd backend && npm run live-sync` → `node src/ingestion/liveSync.js`
- `cd backend && npm test` → `NODE_ENV=test node --experimental-vm-modules node_modules/jest/bin/jest.js`
- `cd backend && npm run test:watch` → same Jest command with `--watch`
- `cd backend && npm run test:coverage` → same Jest command with `--coverage`

### Ingestion / maintenance

- `node backend/src/ingestion/upsert.js` — scheduled 30-min catch-up
- `node backend/src/ingestion/historicalUpsert.js` — historical data backfill
- `node backend/src/ingestion/liveSync.js` — live game worker (deployed as separate Railway service)
- `node backend/src/ingestion/computePlayerEmbeddings.js` — player similarity vector computation
- `node backend/src/ingestion/scripts/backfillStatsTeamid.js` — backfill stats.teamid
- `node backend/src/ingestion/scripts/backfillPlays.js` — backfill plays table
- `node backend/src/ingestion/scripts/backfillTeamColors.js` — backfill teams.primary_color
- `node backend/src/ingestion/scripts/backfillEmbeddings.js` — backfill game embeddings
- `node backend/prisma/seeds/seedAliases.js` — seed player aliases

### Prisma

- `cd backend && node_modules/.bin/prisma generate` — regenerate client after schema changes
- `cd backend && node_modules/.bin/prisma migrate dev --name <desc>` — apply schema change locally
- `cd backend && node_modules/.bin/prisma migrate deploy` — apply migrations on production
- `cd backend && node_modules/.bin/prisma migrate status` — check migration state

## Environment

- Frontend env example: `frontend/.env.example`
  - `VITE_API_URL=http://localhost:8080`
  - `VITE_SUPABASE_URL=...`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=...`
- Backend env example: `backend/.env.example`
  - `DATABASE_URL=...`
  - `OPENAI_API_KEY=...`
  - `SUPABASE_URL=...`
  - `SUPABASE_SECRET_KEY=...`
  - `SUPABASE_WEBHOOK_SECRET=...`
  - `REDIS_URL=...` (optional)
  - `TAVILY_SECRET_KEY=...` (optional)
- Backend env loading: `backend/src/config/env.js`

## Constraints and Gotchas

- Frontend API base URL is always `VITE_API_URL`; all fetch calls use the `api/client.js` wrapper.
- Vite dev proxy target is hardcoded to `http://192.168.1.68:8080` in `frontend/vite.config.js`.
- Backend CORS is allowlist-based (`backend/src/middleware/index.js`): `localhost:5173–5175`, `192.168.1.68:5173–5175`, `https://scorva.vercel.app`, and `https://scorva.dev`. Update `corsOrigins` for new origins.
- Rate limiting (`backend/src/middleware/index.js`):
  - General limiter on all `/api` routes.
  - Stricter `aiLimiter` for AI summary route (mounted inside `routes/aiSummary.js`).
  - `chatLimiter` for chat route (mounted inside `routes/chat.js`).
  - `chatSseConnectionLimiter` on `/api/chat` and `sseConnectionLimiter` on `/api/live` for concurrent SSE connections.
  - Webhook route is mounted before all limiters — no rate limiting on `/api/webhooks/supabase-auth`.
- AI summaries are cache-first and persisted to `games.ai_summary`; generation only triggers for games with a `Final` status.
- `playerInfo` uses `getCurrentSeason(league)` from `cache/seasons.js` for season resolution.
- Backend server starts listening directly in `backend/src/index.js` (no exported app instance for tests — tests create their own Express app).
- All imports must use `.js` extensions (both packages use ESM `"type": "module"`).
- Prisma shadow DB requires `pg_trgm` extension; `prisma migrate dev` may fail locally — apply SQL manually then `prisma migrate resolve --applied`.
- **Users table** stores `id`, `email`, `first_name`, `last_name`, `default_league`. Populated two ways: (1) Supabase webhook `POST /api/webhooks/supabase-auth` on signup — email/password users pass name via `options.data`, Google OAuth users split `full_name`; (2) `ensureUser()` in `favoritesService.js` as fallback. Both use `ON CONFLICT DO UPDATE` with `COALESCE` — never overwrites existing values.
- **User preferences** (`default_league`): fetched via `useUserPrefs` hook. Homepage `activeLeague` starts as `null` and only renders tabs once resolved — prevents NBA flash. Settings drawer updates via `PATCH /api/user/profile`. `updateUser` service uses COALESCE so omitted fields are unchanged.
- **Settings drawer**: opened from the navbar avatar dropdown. Two tabs: Favorites (add/remove favorites + default league picker) and Account (edit name, change password, delete account). Not a separate route/page.
- **Account deletion**: `DELETE /api/user/account` → `supabaseAdmin.auth.admin.deleteUser()` first → then `userService.deleteUser()` (cascades favorites). Uses `SUPABASE_SECRET_KEY` env var.
- **Google OAuth detection**: use `user.app_metadata.providers.includes("email")` — not the single `provider` string. Password section hidden for OAuth users; "Signed in with Google" badge shown.
- **Auth modal**: fully centered all screen sizes (`items-center`), outside-click dismissible, `max-h-[90dvh]` scrollable, close button always visible.
- **apiFetch** supports `method` + `body` params; sets `Content-Type: application/json` when body present; handles 204 no-content; 15s default timeout with `AbortSignal.any`.
- **Favorites routes** all require `requireAuth` at the router level in `routes/favorites.js`. User routes require `requireAuth` in `routes/user.js`.
- When mocking auth routes in tests, mock `requireAuth` to call `next()` and set `req.user = { id: "test-uuid" }`.

## Testing

- Jest config: `backend/jest.config.js`
- Tests live in `backend/__tests__/` organized by category:
  - `routes/` — Supertest route tests for all endpoints
  - `services/` — Service unit tests
  - `ingestion/` — Upsert, mapping, and live sync tests
  - `controllers/` — Controller tests
  - `db/` — Database connection and notification bus tests
  - `cache/` — Redis caching and seasons helper tests
  - `middleware/` — Auth and rate limiter tests
  - `utils/` — Utility function tests
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

- Surfaces: `surface-base` (#0a0a0c), `surface-primary` (#111114), `surface-elevated` (#1a1a1f), `surface-overlay` (#222228), `surface-subtle` (#2a2a32)
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
