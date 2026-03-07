# Plan: 30s Live Sync Worker + SSE Polling + Live Animation System

## Context

The app currently fetches game data once on mount via REST — no real-time updates. Live games (status `'IN'`) show a static "Live" pill but scores never refresh until the user navigates away and back.

Two problems to solve:
1. **Write side**: DB only refreshes when `upsert.js` runs (every ~5min). Need a persistent worker that re-fetches live game scores/stats from ESPN every 30s.
2. **Read side**: No push mechanism. Need SSE endpoints so connected clients receive DB-fresh data without polling.

Without both, SSE just re-pushes unchanged data between `upsert.js` runs.

---

## Architecture

```
ESPN API
   ↑ (every 30s, live games only)
liveSync.js worker  ←── queries DB for status='IN' games
   ↓ upserts scores/stats
PostgreSQL
   ↑ (every 30s per connected client)
liveStreamService.js
   ↓ SSE push
EventSource (frontend)
   ↓ state update
React (GamePage / GameCard)
   ↓ key change
Framer Motion animation
```

- `upsert.js` (existing) — unchanged, keeps running for scheduled games, transitions to Final, and catch-up
- `liveSync.js` (new) — persistent worker, 30s interval, live games only, separate Railway service
- SSE endpoints — query Postgres on each tick, push to connected clients
- No Redis needed — Postgres handles the read load at this scale

---

## Part 1 — Live Sync Worker (write side)

### `backend/src/populate/liveSync.js` (new)

Entry point for the Railway worker service. Responsibilities:
- On startup, query DB for any games currently `status = 'IN'` across all leagues
- If none found, log and exit cleanly (no ESPN calls, no idle loop)
- If live games exist, start a 30s `setInterval`:
  - Re-query DB for live games each tick (games may finish mid-run)
  - For each live game, call ESPN boxscore endpoint (same URL pattern used by `eventProcessor.js`)
  - Call `upsertGame()` + `upsertStat()` for each — reuse existing pipeline functions directly
  - When zero live games remain, clear interval and exit
- Handles `SIGTERM` gracefully (Railway sends this on redeploy) — clears interval, closes DB pool

### `backend/src/populate/src/fetchLiveGame.js` (new)

Thin wrapper around the ESPN boxscore fetch already done inside `eventProcessor.js`. Extracts just the live-game portion:
- Accepts `{ eventId, league, homeTeamId, awayTeamId }`
- Returns `{ homescore, awayscore, status, quarters, players: [...] }`
- Reuses `mapStatsToSchema.js` for stat column mapping

No new ESPN API surface — same endpoints already used by `eventProcessor.js`.

### Railway setup

Add a second service in the Scorva Railway project:
- Source: same GitHub repo
- Root directory: `backend`
- Start command: `node src/populate/liveSync.js`
- Restart policy: `Always`
- Same env vars as the API service (copy or use shared variable group)
- No PORT binding — Railway treats it as a worker automatically

`upsert.js` stays on its existing schedule (Railway cron or external trigger). The two workers are independent — `liveSync.js` handles in-progress games at 30s granularity; `upsert.js` handles everything else.

---

## Part 2 — SSE Endpoints (read/push side)

### `backend/src/routes/liveStream.js` (new)

Thin router:
```
GET /live/:league/games          → liveStreamController.streamGames
GET /live/:league/games/:gameId  → liveStreamController.streamGame
```

### `backend/src/controllers/liveStreamController.js` (new)

- Validates `league` param (`nba`/`nfl`/`nhl`), returns 400 otherwise
- Sets SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` (disables Nginx buffering on Railway)
- Calls `res.flushHeaders()` immediately
- Delegates interval + cleanup to service
- On `req.on('close')`: calls service cleanup

### `backend/src/services/liveStreamService.js` (new)

Reuses existing service query functions:

- `streamGames(league, sendFn, closeFn)`:
  - Calls `gamesService.getGames(league)` immediately + every 30s
  - Sends `data: <JSON>\n\n` via `sendFn`
  - Sends heartbeat comment `: ping\n\n` every 15s (keeps Railway's 60s idle timeout from closing connection)
  - If no `'IN'` status games in result → sends `event: done\ndata: {}\n\n` and calls `closeFn`
  - Returns cleanup fn (clears both intervals)

- `streamGame(league, gameId, sendFn, closeFn)`:
  - Same pattern, calls `gameInfoService.getGame(league, gameId)`
  - Sends `event: done` when game status is Final

### `backend/src/index.js` (modified)

```js
import liveStreamRouter from './routes/liveStream.js';
app.use('/api/live', generalLimiter, liveStreamRouter);
```

---

## Part 3 — Frontend

### New files

**`frontend/src/hooks/useLiveGames.js`**
- Accepts `league` and `hasLiveGames` boolean
- Opens `EventSource` only when `hasLiveGames` is true
- On `message`: updates game list state
- On `event: done`: closes EventSource
- On `error`: closes and sets `streamError`
- Cleans up on unmount or league change
- Returns `{ liveGames, isStreaming, streamError }`

**`frontend/src/hooks/useLiveGame.js`**
- Accepts `league`, `gameId`, `isLive` boolean
- Opens `EventSource` only when `isLive` is true
- Merges SSE updates into local game state
- On `event: done`: closes EventSource, marks `isStreaming = false`
- Returns `{ liveData, isStreaming }`

### Modified files

**`frontend/src/api/games.js`** — add SSE URL helpers:
```js
export function getLiveGamesStreamUrl(league) { ... }
export function getLiveGameStreamUrl(league, gameId) { ... }
```

**`frontend/src/hooks/useGame.js`**
- Expose `isLive` flag (derived from `gameData.status`)
- GamePage uses this to conditionally call `useLiveGame`

**`frontend/src/hooks/useHomeGames.js`**
- After initial fetch, derive `hasLiveGames` per league
- Pass into `useLiveGames`; merge returned `liveGames` over base state

**`frontend/src/pages/LeaguePage.jsx`** + **`frontend/src/pages/Homepage.jsx`**
- Wire in `useLiveGames` — no structural changes, animation lives inside `GameCard`

---

## Part 4 — Animations

### Design principles (matching existing system)
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (already in `motion.js`)
- No `scale-105` — translate and opacity only
- Score increase: brief `bg-win/10` flash on the scoring team's side (~600ms)
- Stat change: accent-tinted flash (`rgba(232,134,58,0.15)`) on the updated cell

### `frontend/src/utilities/motion.js` (modified) — add:

```js
// Wrap score in AnimatePresence + key={score} to trigger on change
export const scoreUpdateVariants = {
  initial: { y: -8, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
  exit:    { y: 8,  opacity: 0, transition: { duration: 0.15 } },
};

// Trigger animate="flash" imperatively when value changes
export const statFlashVariants = {
  initial: { backgroundColor: 'transparent' },
  flash:   {
    backgroundColor: ['transparent', 'rgba(232,134,58,0.15)', 'transparent'],
    transition: { duration: 0.7, ease: 'easeOut' },
  },
};
```

### `frontend/src/components/cards/GameCard.jsx` (modified)
- Score values: `<AnimatePresence mode="popLayout">` + `<motion.span key={score} variants={scoreUpdateVariants}>` — changing score triggers exit-down / enter-top animation
- Scoring team side: track `prevScore` in `useRef`; on increase, briefly apply `bg-win/10` transition
- Live pill: `animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}` breathing pulse

### `frontend/src/pages/GamePage.jsx` (modified)
- **Header scores**: same `AnimatePresence` + key pattern as GameCard
- **Quarter/period cells**: `motion.td` with `statFlashVariants`; trigger `animate="flash"` when value changes
- **Box score stat cells**: `motion.td` flash per cell; track previous values in `useRef` map keyed by `${playerId}:${statName}`
- **Top performer cards**: add `statFlashVariants` triggered when stat value updates
- **Live pill**: same pulse as GameCard
- **"Last updated" label**: `text-text-tertiary` text below Live pill — `Updated Xs ago`, ticked by `setInterval(1000)`, reset on each SSE message

---

## Part 5 — Docs (`CLAUDE.md`)

**API endpoints** — add:
```
GET /live/:league/games          — SSE stream; pushes live game list every 30s; closes when no live games remain
GET /live/:league/games/:gameId  — SSE stream; pushes full game detail every 30s; closes when game is Final
```

**Key file locations** — add rows for:
`liveSync.js`, `fetchLiveGame.js`, `liveStreamService.js`, `liveStreamController.js`, `liveStream.js` (route), `useLiveGame`, `useLiveGames`

**Important conventions** — add:
- `liveSync.js` worker runs as a separate Railway service; reuses `upsertGame`/`upsertStat` pipeline; exits when no live games remain
- SSE connections reuse `gamesService`/`gameInfoService` queries; `X-Accel-Buffering: no` header required for Railway
- No Redis needed; Postgres handles read load at this scale

---

## Implementation Order

### Write side first (worker)
1. `backend/src/populate/src/fetchLiveGame.js`
2. `backend/src/populate/liveSync.js`
3. Deploy as Railway worker service; verify ESPN → Postgres upserts every 30s during a live game

### SSE (read/push)
4. `backend/src/services/liveStreamService.js`
5. `backend/src/controllers/liveStreamController.js`
6. `backend/src/routes/liveStream.js`
7. Mount in `backend/src/index.js`

### Frontend
8. `frontend/src/api/games.js` — URL helpers
9. `frontend/src/hooks/useLiveGames.js`
10. `frontend/src/hooks/useLiveGame.js`
11. `frontend/src/utilities/motion.js` — new variants
12. `frontend/src/components/cards/GameCard.jsx` — score + live pill animations
13. `frontend/src/pages/GamePage.jsx` — full live animation treatment
14. `frontend/src/hooks/useGame.js` — expose `isLive`
15. `frontend/src/hooks/useHomeGames.js` — wire in `useLiveGames`
16. `frontend/src/pages/LeaguePage.jsx` + `Homepage.jsx` — pass live data through

### Docs
17. `CLAUDE.md`

---

## Verification

- `node src/populate/liveSync.js` with a live game in DB → ESPN calls every 30s, scores/stats updating in Postgres; process exits when game goes Final
- No live games → process exits immediately without opening any intervals
- `curl -N http://localhost:3001/api/live/nba/games` → `data:` events every 30s, `: ping` every 15s, `event: done` when no live games
- GamePage open during a live game → box score and scores update without page reload; score change triggers translate animation; stat cell flashes accent on change; Live pill pulses; "Updated Xs ago" resets on each push
- Game goes Final → `event: done` received → SSE closes, no further network activity
