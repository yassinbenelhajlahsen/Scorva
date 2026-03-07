# Plan: 30s SSE Live Game Polling + Live Animation System

## Context

The app currently fetches game data once on mount via REST — no real-time updates. Live games (status `'IN'`) show a static "Live" pill but scores never refresh until the user navigates away and back. This plan adds Server-Sent Events (SSE) to push DB-fresh game data to connected clients every 30 seconds, and adds Framer Motion animations so score changes, box score updates, and stat cards are visually reactive.

The backend's `upsert.js` script already writes live scores/stats to Postgres. SSE closes the gap between DB writes and what the user sees.

---

## Architecture Decision

- **SSE, not polling**: client opens one persistent `EventSource` connection; server pushes every 30s from a `setInterval` that queries Postgres directly (reusing existing service functions). No Redis needed — Postgres handles the read load.
- **Two SSE endpoints**: one for the games list (league page / homepage) and one for single game detail (GamePage box score + stats).
- **Conditional activation**: hooks detect live games first via a normal REST fetch, then open SSE only if `status === 'IN'` is present. Completed/scheduled games never open a stream.
- **Auto-close**: server sends a `event: done` event when a game transitions to Final; client closes the EventSource.

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
// Returns { liveData, isStreaming }
```

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

### `frontend/src/pages/GamePage.jsx`
- **Header scores**: same `AnimatePresence` + key-based animation as GameCard
- **Quarter/period score cells**: wrap each cell value in `motion.td` with `variants={statFlashVariants}` — when value changes, trigger `flash` animation via `animate` prop state
- **Box score rows**: each stat value cell uses `motion.td` with flash on change; track previous values in a `useRef` map keyed by `playerId + statName`
- **Top performers stat cards**: `motion.div` with `whileHover` already; add `variants={statFlashVariants}` triggered when stat value updates
- **Live pill**: same pulse animation as GameCard
- **"Last updated" timestamp**: small `text-text-tertiary` text below the Live pill showing `Updated X seconds ago`, updating every second via `setInterval`

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

## Implementation Order

1. `backend/src/services/liveStreamService.js`
2. `backend/src/controllers/liveStreamController.js`
3. `backend/src/routes/liveStream.js`
4. Mount in `backend/src/index.js`
5. `frontend/src/api/games.js` — add URL helpers
6. `frontend/src/hooks/useLiveGames.js`
7. `frontend/src/hooks/useLiveGame.js`
8. `frontend/src/utilities/motion.js` — add new variants
9. `frontend/src/components/cards/GameCard.jsx` — score + live pill animations
10. `frontend/src/pages/GamePage.jsx` — full live animation treatment
11. `frontend/src/hooks/useGame.js` — expose `isLive`, integrate SSE hook
12. `frontend/src/hooks/useHomeGames.js` — integrate `useLiveGames`
13. `frontend/src/pages/LeaguePage.jsx` + `Homepage.jsx` — wire in live data
14. `CLAUDE.md` — update docs

---

## Verification

- Start backend locally; open `curl -N http://localhost:3001/api/live/nba/games` during a live NBA game (or stub status to 'IN' in DB) → should receive `data:` events every 30s and `: ping` every 15s
- Open GamePage for a live game → scores and box score should update without page reload
- Score change → number animates out/in with translate; scoring team side briefly flashes green
- Live pill pulses continuously
- Game transitions to Final → `event: done` received → SSE closes, no more updates
- No live games → SSE endpoint returns `event: done` immediately after first query; no open connections leak
- Backend tests: mock `gamesService.getGames` + `gameInfoService`, verify SSE headers, data format, heartbeat, and done-event behavior
