# Scorva — CLAUDE.md

## Project overview
Multi-league sports stats web app (NBA, NFL, NHL). Data flows: ESPN API → PostgreSQL → Express backend → React frontend.

## Stack
- **Frontend**: React 19, Vite 6, React Router 7, Tailwind CSS v4, Framer Motion 12
- **Backend**: Node.js + Express 5, PostgreSQL (`pg`), Prisma 7 (schema/migrations only)
- **Auth**: Supabase Auth — email/password + Google OAuth; JWT verified server-side
- **AI**: OpenAI SDK for game summaries
- **Testing**: Jest 29 + Supertest (backend only)
- All packages use ESM (`"type": "module"`). Always use `.js` extensions in imports.

## Commands
```bash
# Frontend
cd frontend && npm run dev        # dev server
cd frontend && npm run build      # production build

# Backend
cd backend && npm run start       # start server
cd backend && npm test            # run all tests
cd backend && npm test -- <pat>   # run matching tests
cd backend && npm run test:coverage

# Prisma
cd backend && node_modules/.bin/prisma generate          # after schema changes
cd backend && node_modules/.bin/prisma migrate dev --name <desc>
cd backend && node_modules/.bin/prisma migrate deploy    # production
```

## Backend architecture (4 layers)
```
Route (routes/) → Controller (controllers/) → Service (services/) → DB (db/db.js)
```
- **Routes**: thin — only delegates to controller, no logic
- **Controllers**: extracts params/query, calls service, sends response, catches errors
- **Services**: raw SQL via `pg` Pool (`pool.query()`), returns plain data
- **DB**: `backend/src/db/db.js` — `pg` Pool singleton

## Key file locations
| What | Where |
|---|---|
| Backend entry | `backend/src/index.js` |
| CORS + rate limits | `backend/src/middleware/index.js` |
| JWT auth middleware | `backend/src/middleware/auth.js` |
| Routes | `backend/src/routes/` |
| Controllers | `backend/src/controllers/` |
| Services | `backend/src/services/` |
| Prisma schema | `backend/prisma/schema.prisma` |
| Generated client | `backend/src/generated/prisma/` (do not edit) |
| Data ingestion | `backend/src/populate/` |
| Frontend entry | `frontend/src/main.jsx` |
| Frontend router | `frontend/src/App.jsx` |
| Design tokens | `frontend/src/index.css` (`@theme`) |
| Supabase client | `frontend/src/lib/supabase.js` |
| Auth context + modal | `frontend/src/context/AuthContext.jsx` |
| OAuth callback page | `frontend/src/pages/AuthCallback.jsx` |
| API wrappers | `frontend/src/api/` |
| Data hooks | `frontend/src/hooks/` |
| Favorites API | `frontend/src/api/favorites.js` |
| Favorites hooks | `frontend/src/hooks/useFavorites.js`, `frontend/src/hooks/useFavoriteToggle.js` |
| Webhook handler | `backend/src/routes/webhooks.js`, `backend/src/controllers/webhooksController.js` |
| Test suite | `backend/__tests__/` |
| Test helpers | `backend/__tests__/helpers/testHelpers.js` |

## API endpoints (all under `/api`)
- `GET /:league/teams`
- `GET /:league/standings`
- `GET /:league/games`
- `GET /:league/games/:gameId`
- `GET /:league/players`
- `GET /:league/players/:playerId`
- `GET /:league/seasons`
- `GET /search`
- `GET /games/:id/ai-summary` — **requires `Authorization: Bearer <token>` header**
- `GET /favorites` — requires auth; returns `{ players: [...], teams: [...] }` with recent stats/games
- `GET /favorites/check?playerIds=1,2&teamIds=3,4` — requires auth; returns which IDs are favorited
- `POST /favorites/players/:playerId` — requires auth; adds player favorite
- `DELETE /favorites/players/:playerId` — requires auth; removes player favorite
- `POST /favorites/teams/:teamId` — requires auth; adds team favorite
- `DELETE /favorites/teams/:teamId` — requires auth; removes team favorite
- `POST /webhooks/supabase-auth` — Supabase auth webhook; verified by `Authorization: <SUPABASE_WEBHOOK_SECRET>` header; inserts new user into `users` table on signup

## Frontend routes
- `/` → Homepage
- `/:league` → LeaguePage
- `/:league/teams/:teamId` → TeamPage
- `/:league/players/:playerId` → PlayerPage
- `/:league/games/:gameId` → GamePage
- `/auth/callback` → AuthCallback (OAuth popup handler — no layout shell)

## Design system
Tailwind v4 — config only in `frontend/src/index.css` (`@theme`). No `tailwind.config.js`.
- Apple-style dark theme: `surface-base/primary/elevated/overlay`, `text-primary/secondary/tertiary`, `accent`, `win`, `loss`, `live`
- Card: `bg-surface-elevated border border-white/[0.08] rounded-2xl`
- Hover: always `hover:-translate-y-0.5`, never `hover:scale-105`
- Transitions: `transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]`

## Important conventions
- **Never edit** `backend/src/generated/prisma/` — regenerate with `prisma generate`
- **CORS allowlist** in `backend/src/middleware/index.js` — update `corsOrigins` for new origins
- **AI route** uses stricter `aiLimiter` + `requireAuth` middleware mounted in `index.js`
- **AI summaries** are cache-first, persisted to `games.ai_summary`, only generated for finalized games, requires auth
- **Auth middleware** (`requireAuth`) calls `supabase.auth.getUser(token)` using `SUPABASE_SECRET_KEY` + `PROJECT_URL` env vars
- **Google OAuth popup** flow: `skipBrowserRedirect: true` → open popup → `/auth/callback` page closes popup via `postMessage` → parent modal closes
- **Prisma** is for schema/migrations only; runtime uses `pg` directly
- **game_label** column holds playoff round labels (e.g. `"NBA Finals - Game 1"`), null for regular season
- **Users table** (`users`) stores Supabase auth UUIDs + `email`, `first_name`, `last_name`. Populated via Supabase webhook (`POST /api/webhooks/supabase-auth`) on signup. Email/password users pass name via `options.data` in `supabase.auth.signUp()`; Google OAuth users have `full_name` split on first space. `favoritesService.ensureUser()` is a fallback that upserts on first favorite action. Webhook secret stored in `SUPABASE_WEBHOOK_SECRET` env var.
- **Favorites** all routes require `requireAuth`; service uses `ROW_NUMBER()` window functions to get 3 most recent finalized stats/games per favorite

## Adding a new endpoint (checklist)
1. `backend/src/routes/myRoute.js` — router + controller delegation only
2. `backend/src/controllers/myController.js` — extract params, call service, handle errors
3. `backend/src/services/myService.js` — SQL query, return data
4. Mount in `backend/src/index.js` under `/api`
5. Test in `backend/__tests__/routes/myRoute.test.js` — mock db with `createMockPool()`

## Testing patterns
- Mock `db/db.js` using `jest.unstable_mockModule()` before importing
- `createMockPool()` returns a mock with `.query.mockResolvedValue({ rows: [...] })`
- Test: success case, DB error case, edge cases, different league params
- See `backend/__tests__/README.md` for full guide
