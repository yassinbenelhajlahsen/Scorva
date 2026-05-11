# SSE Partial Game Updates — Design

**Status:** Approved (2026-05-10)
**Owner:** yassinbenelhajlahsen

## Problem

The league-wide SSE (`/api/live/:league/games`) is currently asked to do two jobs:
1. Push live updates for in-progress games.
2. Act as the source of truth for the entire game slate (live + Final + Scheduled rows).

Job (2) is incidental — it exists because every SSE tick wholesale-replaces the league's array in the React Query cache via `setQueryData(... payload)`. If the payload didn't carry Final/Scheduled rows, they would disappear between visibility-reconnect REST refetches.

This produces:
- **Wire payload bloat.** Each notification re-sends up to 12 full game rows (with team joins and a LATERAL series-wins subquery), even when only one game's score changed.
- **Architectural smell.** SSE doubles as state-of-the-world transport. The "live" notion leaks into slate ordering, scheduled-game inclusion, and `done`-event aggregation.

The PG `pg_notify('game_updated', NEW.eventid::text)` payload already identifies which game changed (`backend/prisma/migrations/20260307000001_add_game_updated_notify_trigger/migration.sql:5`), but the current `streamGames` controller ignores it and refetches the whole slate (`backend/src/controllers/games/liveController.js:48`).

## Goals

- SSE emits **per-game partial updates** keyed by id, carrying only volatile fields.
- Frontend **merges by id** instead of wholesale-replacing the league cache.
- REST remains the slate source of truth, hit on mount + visibility reconnect (already does both).
- No regression in update latency or correctness.

## Non-goals

- Per-game SSE stream (`streamGame` / `useLiveGame` / `useGame`) — independent stream, different consumers, untouched.
- New cache layers, feature flags, or rollout gating — change is small and internal.
- Reordering, slate composition, or season/date logic — REST handles all of that.

## Design

### Wire format

SSE emits one message per pg_notify, payload is a partial:

```json
{ "id": 12345, "status": "In Progress - Q3", "homescore": 88, "awayscore": 91, "current_period": 3, "clock": "5:42" }
```

`id` is the internal `games.id` PK (returned by the backend lookup), not the ESPN eventid. Frontend keys by `games.id` everywhere — same key it already uses in REST responses.

Volatile fields chosen to match what existing consumers already pick from the full payload (`usePlayerLiveGames.js:31-37`, `useTeamNextGame.js:42-47`).

### Backend

#### 1. New service helper: `getLiveGamePartial(league, eventid)`

Location: `backend/src/services/games/gamesService.js` (alongside `getGames`).

```js
export async function getLiveGamePartial(league, eventid) {
  const { rows } = await pool.query(
    `SELECT id, status, homescore, awayscore, current_period, clock
     FROM games WHERE league = $1 AND eventid = $2`,
    [league, eventid]
  );
  return rows[0] ?? null;
}
```

- Not cached — call is per-tick and small. Cache would only add staleness risk.
- Returns `null` for cross-league notifications (the same pg_notify channel fires for all leagues; the controller filters).

#### 2. Rewrite `streamGames` (`backend/src/controllers/games/liveController.js`)

Changes:
- `subscribe(callback)` callback signature already receives the pg_notify `msg`. Read `msg.payload` (a string) for the eventid.
- For each notification: call `getLiveGamePartial(league, eventid)`. Skip if `null` (wrong league or unknown eventid).
- Emit `data: ${JSON.stringify(partial)}\n\n`.
- **Remove** the initial `await send()` call. SSE is now event-only; the frontend has the REST snapshot.
- **Remove** `event: done` emission and the `allTerminal` aggregate check. SSE stays open until subscriber count → 0 (frontend gates via `hasActiveGame(games)` from REST).
- Heartbeat (`HEARTBEAT_INTERVAL_MS = 15_000`) unchanged.

Notification dispatch — current subscribe API in `notificationBus.js:45-52` adds the callback to `emitter.on("notification", callback)`. The callback receives the raw `msg` from pg `notification` events, which has `.payload` and `.channel`. No changes to `notificationBus.js`.

#### 3. `notificationBus.js`

Unchanged.

#### 4. `streamGame` (per-game SSE)

Unchanged. It's a different stream serving a different consumer (`useLiveGame` → `useGame` for the game detail page).

### Frontend

#### 1. `sharedSSE.js` — accumulator option

Add an optional `accumulate(prev, next) => merged` to the subscribeSSE options. When provided, sharedSSE applies it to incoming `data` and stores the *accumulated* value in `state.lastSnapshot.data`. Late subscribers replay the accumulated state, not just the most recent message.

```js
// inside es.onmessage, after parse:
const next = accumulate
  ? accumulate(state.lastSnapshot?.data, parsed)
  : parsed;
state.pendingPayload = next;
// existing throttle path then broadcasts state.pendingPayload
```

This keeps the transport shape-agnostic (it doesn't know what a "game" is) but supports stateful streams. The polling fallback path also runs through `accumulate` so the shape stays consistent on degradation.

Throttle behavior (`THROTTLE_MS = 1000`) is preserved.

#### 2. `useLiveGames` — return Map

`useLiveGames(league)` now returns `{ liveGamesMap: Map<id, partial>, streamError }`.

```js
const accumulate = (prev, patch) => {
  const next = new Map(prev ?? []);
  next.set(patch.id, { ...next.get(patch.id), ...patch });
  return next;
};

return subscribeSSE(url, { fetchFallback, accumulate }, ({ data, ... }) => {
  if (data !== undefined) setLiveGamesMap(data);
  ...
});
```

The `fetchFallback` path (used when SSE fails 3 times and falls back to polling) currently calls `getLeagueGames(league)`, which returns a full `Game[]`. To keep the accumulated shape consistent, the fetchFallback wrapper projects each game to the volatile-fields shape `{id, status, homescore, awayscore, current_period, clock}` and returns a `Map<id, partial>`. The `accumulate` function then merges into the existing accumulated map (same code path as SSE messages).

#### 3. Three slate hooks — merge by id

`useHomeGames.js`, `useLeagueData.js`, `useSlateGames.js` switch from wholesale-replace to merge-by-id.

`useHomeGames` (per-league):
```js
queryClient.setQueryData(queryKeys.homeGames(), (prev) => {
  if (!prev) return prev;
  const mergeOne = (arr, map) =>
    map ? arr.map(g => map.has(g.id) ? { ...g, ...map.get(g.id) } : g) : arr;
  return {
    nba: mergeOne(prev.nba, liveNbaMap),
    nhl: mergeOne(prev.nhl, liveNhlMap),
    nfl: mergeOne(prev.nfl, liveNflMap),
  };
});
```

`useLeagueData` and `useSlateGames` use the same merge but apply it inside the `{games, resolvedDate, resolvedSeason}` envelope when present:
```js
queryClient.setQueryData(key, (prev) => {
  if (!prev) return prev;
  const arr = Array.isArray(prev) ? prev : prev.games ?? [];
  const merged = arr.map(g =>
    liveGamesMap.has(g.id) ? { ...g, ...liveGamesMap.get(g.id) } : g
  );
  return Array.isArray(prev) ? merged : { ...prev, games: merged };
});
```

The current date-filter in `useSlateGames` (drops future-date rows from the SSE payload) goes away — there are no future-date rows in a partial-by-id world. The slate is whatever REST returned; SSE only updates rows already in it.

#### 4. `usePlayerLiveGames`

```js
const map = {};
for (const [id, partial] of liveGamesMap) {
  if (!ids.has(id)) continue;
  map[id] = partial; // already exactly the volatile-fields shape
}
return map;
```

#### 5. `useTeamNextGame`

```js
const fresh = liveGamesMap.get(game.id);
if (!fresh) return;
if (fresh.status?.includes("Final")) {
  queryClient.invalidateQueries({ queryKey: queryKeys.teamNextGame(league, teamId) });
  return;
}
queryClient.setQueryData(queryKeys.teamNextGame(league, teamId), (prev) => {
  if (!prev || prev.kind !== "live" || prev.id !== game.id) return prev;
  return {
    ...prev,
    status: fresh.status,
    teamScore: prev.isHome ? fresh.homescore : fresh.awayscore,
    opponentScore: prev.isHome ? fresh.awayscore : fresh.homescore,
    currentPeriod: fresh.current_period,
    clock: fresh.clock,
  };
});
```

### Untouched
- `notificationBus.js`
- `useVisibilityReconnect.js`
- `streamGame` controller, `useLiveGame`, `useGame`
- All REST endpoints and `getGames`
- React Query cache keys

## Testing

### Backend (`backend/__tests__/`)
- `services/games/gamesService.getLiveGamePartial.test.js` — query shape, returns null for unknown eventid, returns null for wrong league.
- `controllers/games/liveController.streamGames.test.js`:
  - emits one partial per notification matching the eventid in `msg.payload`
  - skips notifications whose eventid resolves to a different league
  - no initial `data:` send before any notification
  - no `event: done` emission, ever
  - heartbeat still fires
  - cleanup on `req.close`

### Frontend (`frontend/src/__tests__/`)
- `hooks/sharedSSE.test.js` — new accumulator path: late subscriber receives accumulated state, polling fallback projects through `accumulate`.
- `hooks/useLiveGames.test.js` — returns `liveGamesMap`, accumulates partials across messages, last-write-wins per id.
- `hooks/useHomeGames.test.js` — partial update merges by id, unchanged rows preserved by reference (structural sharing).
- `hooks/useLeagueData.test.js` — same merge semantics, envelope shape preserved.
- `hooks/useSlateGames.test.js` — same merge semantics, no date-filter regression.
- `hooks/usePlayerLiveGames.test.js` (if exists, else add) — Map iteration produces same `{[id]: {...}}` output.
- `hooks/useTeamNextGame.test.js` (if exists, else add) — Map.get patches cache; Final triggers invalidate.

## Risks & mitigations

- **Late subscriber empty state.** A consumer mounting after the SSE has been streaming for a while gets the accumulated map replayed via `lastSnapshot` — same mechanism that exists today for full-payload streams.
- **eventid collisions across leagues.** ESPN eventids are league-scoped; the same id could in theory exist in NBA and NHL. The backend filter `WHERE league = $1 AND eventid = $2` handles this — `getLiveGamePartial` only returns the row for the requested league, returns null for the other.
- **Late-arriving partial after game removed from slate.** If a Scheduled game was rescheduled out of today's slate, a partial for it would arrive but match no row in `prev`. The merge-by-id is a no-op (`prev.map` skips ids not in the map). Safe.
- **Polling fallback.** Already returns full `Game[]` from `getLeagueGames`; we project it through `accumulate` to keep the Map shape. Slight overhead per fallback poll but acceptable.

## Out of scope / future

- Aggregate `done` event mechanism (decided against — frontend gate handles it).
- Migrating per-game SSE to a delta format.
- Server-side throttling of high-frequency notifications.
