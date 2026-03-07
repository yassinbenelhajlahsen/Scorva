# Plan: 30s SSE Live Game Polling + Live Animation System

## Context

The app currently fetches game data once on mount via REST — no real-time updates. Live games (status `'IN'`) show a static "Live" pill but scores never refresh until the user navigates away and back. This plan adds Server-Sent Events (SSE) to push DB-fresh game data to connected clients every 30 seconds, and adds Framer Motion animations so score changes, box score updates, and stat cards are visually reactive.

The backend's `upsert.js` script already writes live scores/stats to Postgres. SSE closes the gap between DB writes and what the user sees.

---

## Architecture Decision

- **SSE, not polling**: client opens one persistent `EventSource` connection; server pushes every 30s from a `setInterval` that queries Postgres directly (reusing existing service functions). No Redis needed — Postgres handles the read load.
- **Two SSE endpoints**: one for the games list (league page / homepage) and one for single game detail (GamePage box score + stats).
- **Conditional activation**: hooks detect live games first via a normal REST fetch, then open SSE only if status includes `'In Progress'` or `'End of Period'`. Completed/scheduled games never open a stream. (Note: the DB stores ESPN's human-readable `description` — e.g., `"In Progress"`, `"Final"` — not short codes like `"IN"`.)
- **Auto-close**: server sends a `event: done` event when a game transitions to Final; client closes the EventSource.
- **`current_period` + `clock` fields**: The live sync worker plan adds these columns to the `games` table. SSE responses must include them, and frontend components must render them (see "Cross-plan integration" section below).

---

## Backend

### New files

#### `backend/src/routes/liveStream.js`
Thin router delegating to controller:
```
GET /api/live/:league/games          → liveStreamController.streamGames
GET /api/live/:league/games/:gameId  → liveStreamController.streamGame
```

#### `backend/src/controllers/liveStreamController.js`
- Validates `league` param (nba/nfl/nhl), returns 400 otherwise
- Sets SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` (disables Nginx buffering on Railway)
- Calls `res.flushHeaders()` immediately
- Delegates interval logic to service
- On `req.on('close')`: clears all intervals

#### `backend/src/services/liveStreamService.js`
Reuses existing query functions:
- `streamGames(league, sendFn, closeFn)`:
  - Calls existing `gamesService.getGames(league)` immediately + every 30s
  - Sends `data: <JSON>\n\n` via `sendFn`
  - Sends heartbeat comment `: ping\n\n` every 15s (keeps Railway's 60s idle timeout from closing connection)
  - If no `'IN'` status games remain → sends `event: done\ndata: {}\n\n` and calls `closeFn`
  - Returns cleanup function (clears intervals)
- `streamGame(league, gameId, sendFn, closeFn)`:
  - Same pattern but calls `gameInfoService.getGame(league, gameId)`
  - Sends `event: done` when `game.status` is Final

### Modified files

#### `backend/src/index.js`
Mount under `/api` (no auth required — public game data):
```js
import liveStreamRouter from './routes/liveStream.js';
app.use('/api/live', generalLimiter, liveStreamRouter);
```
Note: SSE connections are long-lived and counted as one request each — the existing rate limiter (3000 req/15min in prod) is fine.

#### SSE response configuration
- Include `retry: 30000\n` in the initial SSE response to control the browser's native
  auto-reconnect interval (default is 3 seconds, which is too aggressive for 30s updates)
- The `liveStreamService` must include `current_period` and `clock` in game data (these
  columns are added by the live sync worker plan's migration)

---

## Cross-plan integration (with `live_sync_worker.md`)

The live sync worker writes `current_period` and `clock` to Postgres every 30s. The SSE
service reads from Postgres every 30s. These are not synchronized — worst case, the SSE
read happens right before the worker write, serving data up to ~60s stale. This is
acceptable for a sports app but can be surfaced to users:

- Add `updated_at` timestamp column to `games` (set by `upsertGame` on every write)
- SSE responses include `updated_at` so the frontend "Last updated" timer is accurate
- Alternatively, accept the ~30s jitter and base "Last updated" on SSE message receipt time

The SSE service queries must SELECT `current_period` and `clock` from the `games` table
(added by the worker plan's migration). Both `gamesService.getGames()` and
`gameInfoService.getGame()` need these columns in their SELECT lists.

---

## Frontend

### New files

#### `frontend/src/hooks/useLiveGames.js`
```js
// Opens EventSource only when `hasLiveGames` is true
// Falls back to null if EventSource not supported
// Closes stream when component unmounts or league changes
// Returns { liveGames, streamError }
```

#### `frontend/src/hooks/useLiveGame.js`
```js
// Opens EventSource only when gameData exists and game.status includes 'In Progress'
// Merges SSE updates into local state
// Closes on 'done' event or unmount
// Returns { liveData, isStreaming, connectionError }
```

### Error handling & reconnection strategy

- **Native reconnection**: `EventSource` auto-reconnects on network drops. The server
  sets `retry: 30000` so reconnection attempts happen every 30s (not the default 3s).
- **Error state**: Hooks expose a `connectionError` / `streamError` field. After 3
  consecutive failed reconnections, fall back to periodic REST polling (every 30s via
  `setInterval` + existing fetch functions) so live data still works without SSE.
- **Connection status UI**: Show a small indicator when SSE is disconnected and falling
  back to polling (e.g., subtle `text-text-tertiary` text "Reconnecting..." near the
  Live pill).
- **Multi-tab considerations**: Each browser tab opens its own SSE connection. For typical
  usage (1–2 tabs) this is fine. If tab count becomes a concern, consider using
  `BroadcastChannel` (already used for auth sync) to share SSE data across tabs — one
  leader tab holds the connection, others receive updates via channel messages.

### Modified files

#### `frontend/src/hooks/useGame.js`
- After initial fetch, if game is live → activates `useLiveGame` internally (or exports a flag for GamePage to do it)
- Simpler: export `{ gameData, loading, error, isLive }` and let `GamePage` call `useLiveGame` conditionally

#### `frontend/src/hooks/useHomeGames.js`
- After initial fetch, checks if any game in the active league is live
- If yes, opens SSE for that league and merges updates

#### `frontend/src/api/games.js`
Add SSE URL helpers (not fetch wrappers — just URL builders for EventSource):
```js
export function getLiveGamesStreamUrl(league) { ... }
export function getLiveGameStreamUrl(league, gameId) { ... }
```

---

## Animations

### Design principles (matching existing system)
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (already in `motion.js`)
- No `scale-105` — use translate and opacity only
- Color flashes: use `win` (#34c759) for a team that just scored, fade back to neutral in ~600ms

### `frontend/src/utilities/motion.js` additions
```js
export const scoreFlashVariants = {
  initial: { opacity: 1 },
  flash: { opacity: [1, 0.4, 1], transition: { duration: 0.5, ease: 'easeOut' } },
};

export const scoreUpdateVariants = {
  // Used with AnimatePresence + key={score}
  initial: { y: -8, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
  exit:    { y: 8,  opacity: 0, transition: { duration: 0.15 } },
};

export const statFlashVariants = {
  initial: { backgroundColor: 'transparent' },
  flash:   { backgroundColor: ['transparent', 'rgba(232,134,58,0.15)', 'transparent'],
             transition: { duration: 0.7, ease: 'easeOut' } },
};
```

### `frontend/src/components/cards/GameCard.jsx`
- Wrap score values in `<AnimatePresence mode="popLayout">` + `<motion.span key={score} ...scoreUpdateVariants>` so changing score number animates out-down and new one animates in-top
- Live pill: add `animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}` for a breathing pulse
- Store `prevScore` in a ref; when score increases, briefly set a `bg-win/10` flash class on the scoring team's side
- Show condensed period + clock below score when live: `● LIVE  Q3  2:34` (uses `current_period` + `clock` from game data, rendered via `getPeriodLabel()` from `formatters.js`)

### `frontend/src/pages/GamePage.jsx`
- **Header scores**: same `AnimatePresence` + key-based animation as GameCard
- **Period + clock display**: When live, show `Q3 · 2:34 remaining` next to or below the Live pill using `current_period` + `clock` fields and `getPeriodLabel(period, league)` from `formatters.js` (NBA/NFL → "Q1"–"Q4"/"OT"; NHL → "P1"–"P3"/"OT")
- **Quarter/period score cells**: wrap each cell value in `motion.td` with `variants={statFlashVariants}` — when value changes, trigger `flash` animation via `animate` prop state
- **Box score rows**: each stat value cell uses `motion.td` with flash on change; track previous values in a `useRef` map keyed by `playerId + statName`
- **Top performers stat cards**: `motion.div` with `whileHover` already; add `variants={statFlashVariants}` triggered when stat value updates
- **Live pill**: same pulse animation as GameCard
- **"Last updated" timestamp**: small `text-text-tertiary` text below the Live pill showing `Updated X seconds ago`, updating every second via `setInterval` (based on SSE message receipt time)

### `frontend/src/pages/LeaguePage.jsx` + `frontend/src/pages/Homepage.jsx`
- Import `useLiveGames` and merge with base game state when there are live games
- Pass updated game data down to `GameCard` components (scores change → animation triggers)
- No structural changes needed — animation lives inside `GameCard`

---

## Docs

### `CLAUDE.md` additions
- New SSE endpoints section under **API endpoints**:
  ```
  GET /live/:league/games           — SSE stream; pushes live game list every 30s; closes when no live games remain
  GET /live/:league/games/:gameId   — SSE stream; pushes full game detail every 30s; closes when game is Final
  ```
- New entry in **Key file locations** table for `useLiveGame`, `useLiveGames`, `liveStreamService`
- Add note under **Important conventions**: SSE connections reuse `gamesService` / `gameInfoService` queries; no Redis needed; `X-Accel-Buffering: no` header required for Railway

---

## Testing

### Backend (`backend/__tests__/routes/liveStream.test.js`)
- Mock `gamesService.getGames` and `gameInfoService.getGame` via `jest.unstable_mockModule()`
- Verify SSE response headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`)
- Verify `retry: 30000` is sent in the initial response
- Verify `data:` format contains valid JSON with game fields including `current_period` and `clock`
- Verify `event: done` is sent when no live games remain / game transitions to Final
- Verify cleanup on `req.close` (intervals cleared, no memory leaks)
- Verify 400 response for invalid league param
- Use `createMockPool()` pattern from existing test helpers

### Frontend (`frontend/src/__tests__/hooks/useLiveGame.test.js` + `useLiveGames.test.js`)
- Mock `EventSource` globally: create a mock class that emits `message`, `error`, and custom `done` events
- Test: SSE opens only when game status includes `'In Progress'`
- Test: state updates on `message` event with new game data
- Test: connection closes on `done` event
- Test: cleanup on unmount (EventSource.close() called)
- Test: fallback to REST polling after 3 consecutive connection errors
- Use `renderHook` + `waitFor` from Testing Library

---

## Implementation Order

1. `backend/src/services/liveStreamService.js` — include `current_period` + `clock` in queries
2. `backend/src/controllers/liveStreamController.js` — set `retry: 30000` in initial SSE response
3. `backend/src/routes/liveStream.js`
4. Mount in `backend/src/index.js`
5. `backend/__tests__/routes/liveStream.test.js` — SSE endpoint tests
6. `frontend/src/api/games.js` — add URL helpers
7. `frontend/src/hooks/useLiveGames.js` — with error state + REST fallback
8. `frontend/src/hooks/useLiveGame.js` — with error state + REST fallback
9. `frontend/src/__tests__/hooks/useLiveGame.test.js` + `useLiveGames.test.js`
10. `frontend/src/utilities/motion.js` — add new variants
11. `frontend/src/utilities/formatters.js` — add `getPeriodLabel(period, league)`
12. `frontend/src/components/cards/GameCard.jsx` — score + live pill animations + period/clock display
13. `frontend/src/pages/GamePage.jsx` — full live animation treatment + period/clock display
14. `frontend/src/hooks/useGame.js` — expose `isLive`, integrate SSE hook
15. `frontend/src/hooks/useHomeGames.js` — integrate `useLiveGames`
16. `frontend/src/pages/LeaguePage.jsx` + `Homepage.jsx` — wire in live data
17. `CLAUDE.md` — update docs

---

## Verification

- Start backend locally; open `curl -N http://localhost:3001/api/live/nba/games` during a live NBA game (or stub status to 'IN' in DB) → should receive `data:` events every 30s and `: ping` every 15s
- Open GamePage for a live game → scores and box score should update without page reload
- Score change → number animates out/in with translate; scoring team side briefly flashes green
- Live pill pulses continuously
- Game transitions to Final → `event: done` received → SSE closes, no more updates
- No live games → SSE endpoint returns `event: done` immediately after first query; no open connections leak
- SSE response includes `retry: 30000` — verify browser reconnects at 30s intervals (not 3s default)
- SSE response data includes `current_period` and `clock` fields for live games
- Network disconnect → browser auto-reconnects → after 3 failures, hook falls back to REST polling
- Multiple tabs open to same game → each gets independent SSE connection (acceptable for typical usage)
- Backend tests: mock `gamesService.getGames` + `gameInfoService`, verify SSE headers, data format, heartbeat, and done-event behavior
- Frontend tests: mock `EventSource`, verify hook lifecycle (open/close/fallback)
