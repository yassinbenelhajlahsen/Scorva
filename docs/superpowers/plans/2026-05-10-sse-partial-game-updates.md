# SSE Partial Game Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the league-wide SSE (`/api/live/:league/games`) from full-slate refetch to per-game partial updates keyed by `games.id`, with the frontend merging into the React Query cache by id instead of wholesale-replacing the league array.

**Architecture:** Backend uses the eventid already carried in `pg_notify('game_updated', ...)` to look up only the changed game and emit a small partial. Frontend `useLiveGames` accumulates partials into a `Map<id, partial>`; the three slate hooks (`useHomeGames`, `useLeagueData`, `useSlateGames`) merge by id; `usePlayerLiveGames` and `useTeamNextGame` consume the Map directly. REST remains the slate source-of-truth, hit on mount + visibility reconnect.

**Tech Stack:** Node 20+ Express + `pg` (backend), React 19 + TanStack Query v5 + Vitest (frontend), pg_notify trigger already exists.

**Spec:** `docs/superpowers/specs/2026-05-10-sse-partial-game-updates-design.md`

---

## File Structure

### Backend
- **Modify** `backend/src/services/games/gamesService.js` — add `getLiveGamePartial(league, eventid)` export
- **Modify** `backend/src/controllers/games/liveController.js` — rewrite `streamGames` to emit partials
- **Modify** `backend/__tests__/services/gamesService.test.js` — add `getLiveGamePartial` tests
- **Create** `backend/__tests__/controllers/games/liveController.test.js` — new file (no existing tests for this controller)

### Frontend
- **Modify** `frontend/src/hooks/live/sharedSSE.js` — add `accumulate` option to `subscribeSSE`
- **Modify** `frontend/src/hooks/live/useLiveGames.js` — return `liveGamesMap`, supply accumulator
- **Modify** `frontend/src/hooks/data/useHomeGames.js` — merge-by-id into cache
- **Modify** `frontend/src/hooks/data/useLeagueData.js` — merge-by-id, drop date filter
- **Modify** `frontend/src/hooks/data/useSlateGames.js` — merge-by-id, drop date filter
- **Modify** `frontend/src/hooks/data/usePlayerLiveGames.js` — iterate Map
- **Modify** `frontend/src/hooks/data/useTeamNextGame.js` — `Map.get(id)`
- **Modify** `frontend/src/__tests__/hooks/sharedSSE.test.js` — add accumulator tests
- **Modify** `frontend/src/__tests__/hooks/useLiveGames.test.js` — switch to `liveGamesMap`
- **Modify** `frontend/src/__tests__/hooks/useHomeGames.test.js` — feed Map, assert merge
- **Modify** `frontend/src/__tests__/hooks/useLeagueData.test.js` — feed Map, drop filter test
- **Modify** `frontend/src/__tests__/hooks/useSlateGames.test.js` — feed Map
- **Create** `frontend/src/__tests__/hooks/usePlayerLiveGames.test.js`
- **Create** `frontend/src/__tests__/hooks/useTeamNextGame.test.js`

---

## Task 1: Backend — `getLiveGamePartial` service helper

**Files:**
- Modify: `backend/src/services/games/gamesService.js` (append export)
- Modify: `backend/__tests__/services/gamesService.test.js`

The helper is a single SELECT by `(league, eventid)`. Returns `null` for the cross-league case (the same `pg_notify` channel fires for every league; the controller filters by passing only its league).

- [ ] **Step 1: Write the failing tests**

Append to `backend/__tests__/services/gamesService.test.js` (inside the existing top-level `describe("gamesService", ...)` block, after `getGameDates`):

```js
  // ─── getLiveGamePartial ──────────────────────────────────────────────────

  describe("getLiveGamePartial", () => {
    it("returns the volatile fields for the matching (league, eventid)", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 42,
          status: "In Progress - Q3",
          homescore: 88,
          awayscore: 91,
          current_period: 3,
          clock: "5:42",
        }],
      });

      const { getLiveGamePartial } = await import(
        resolve(__dirname, "../../src/services/games/gamesService.js")
      );

      const partial = await getLiveGamePartial("nba", "401705234");
      expect(partial).toEqual({
        id: 42,
        status: "In Progress - Q3",
        homescore: 88,
        awayscore: 91,
        current_period: 3,
        clock: "5:42",
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE league = $1 AND eventid = $2"),
        ["nba", "401705234"],
      );
    });

    it("returns null when no row matches (cross-league or unknown eventid)", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const { getLiveGamePartial } = await import(
        resolve(__dirname, "../../src/services/games/gamesService.js")
      );
      const partial = await getLiveGamePartial("nhl", "999999999");
      expect(partial).toBeNull();
    });

    it("selects only the volatile fields (no team joins, no series wins)", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      const { getLiveGamePartial } = await import(
        resolve(__dirname, "../../src/services/games/gamesService.js")
      );
      await getLiveGamePartial("nba", "1");

      const sql = mockPool.query.mock.calls[0][0];
      expect(sql).toMatch(/SELECT\s+id,\s*status,\s*homescore,\s*awayscore,\s*current_period,\s*clock\s+FROM\s+games/);
      expect(sql).not.toMatch(/JOIN/);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- gamesService`
Expected: FAIL — `getLiveGamePartial is not a function` (or similar import error in the test).

- [ ] **Step 3: Implement `getLiveGamePartial`**

Append to `backend/src/services/games/gamesService.js`:

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- gamesService`
Expected: PASS — all 3 new tests green, all existing `gamesService` tests still green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/games/gamesService.js backend/__tests__/services/gamesService.test.js
git commit -m "feat(games): add getLiveGamePartial(league, eventid) helper"
```

---

## Task 2: Backend — Rewrite `streamGames` controller

**Files:**
- Modify: `backend/src/controllers/games/liveController.js:35-80`
- Create: `backend/__tests__/controllers/games/liveController.test.js`

Changes to `streamGames`:
- Drop `getGames(league, { live: true })` refetch.
- Read `msg.payload` (the eventid string) inside the subscribe callback; call `getLiveGamePartial(league, eventid)`; emit `data: <JSON.stringify(partial)>\n\n` if non-null.
- Drop the initial `await send()` call. The frontend already has the REST snapshot — no synchronous push needed.
- Drop the `event: done` emission and the `allTerminal` aggregate check. Frontend's `hasActiveGame` gate handles teardown via REST refresh on visibility reconnect.
- Heartbeat unchanged.

`isTerminalStatus` becomes unused in this file — delete it.

- [ ] **Step 1: Write the failing tests**

Create `backend/__tests__/controllers/games/liveController.test.js`:

```js
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the controller
// ---------------------------------------------------------------------------

const mockGetLiveGamePartial = jest.fn();
const mockGetNbaGame = jest.fn();
const mockGetNflGame = jest.fn();
const mockGetNhlGame = jest.fn();
const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();

jest.unstable_mockModule(
  resolve(__dirname, "../../../src/services/games/gamesService.js"),
  () => ({
    getGames: jest.fn(),
    getLiveGamePartial: mockGetLiveGamePartial,
    getGameDates: jest.fn(),
  }),
);

jest.unstable_mockModule(
  resolve(__dirname, "../../../src/services/games/gameDetailService.js"),
  () => ({
    getNbaGame: mockGetNbaGame,
    getNflGame: mockGetNflGame,
    getNhlGame: mockGetNhlGame,
  }),
);

jest.unstable_mockModule(
  resolve(__dirname, "../../../src/db/notificationBus.js"),
  () => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  }),
);

const { streamGames } = await import(
  resolve(__dirname, "../../../src/controllers/games/liveController.js")
);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRes() {
  const res = {
    writeHead: jest.fn(),
    write: jest.fn(),
    end: jest.fn(() => { res.writableEnded = true; }),
    status: jest.fn(function () { return this; }),
    json: jest.fn(),
    writableEnded: false,
  };
  return res;
}

function makeReq(league = "nba") {
  const handlers = {};
  return {
    params: { league },
    on: jest.fn((event, fn) => { handlers[event] = fn; }),
    _trigger: (event) => handlers[event]?.(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // Capture the registered notification callback so tests can fire it.
  mockSubscribe.mockImplementation(async (cb) => {
    mockSubscribe._cb = cb;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("liveController.streamGames", () => {
  it("rejects invalid league with 400", async () => {
    const req = makeReq("xyz");
    const res = makeRes();
    await streamGames(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid league" });
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("opens SSE headers and subscribes to the notification bus", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      "Content-Type": "text/event-stream",
    }));
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it("does NOT push an initial data: message before any notification", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);
    // Only the retry: ... and possibly headers are written. No `data:` line yet.
    const writes = res.write.mock.calls.map((c) => c[0]);
    expect(writes.some((w) => typeof w === "string" && w.startsWith("data:"))).toBe(false);
  });

  it("emits one partial per notification using msg.payload as eventid", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    mockGetLiveGamePartial.mockResolvedValueOnce({
      id: 42, status: "In Progress - Q3", homescore: 88, awayscore: 91, current_period: 3, clock: "5:42",
    });

    await mockSubscribe._cb({ channel: "game_updated", payload: "401705234" });

    expect(mockGetLiveGamePartial).toHaveBeenCalledWith("nba", "401705234");
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({
        id: 42, status: "In Progress - Q3", homescore: 88, awayscore: 91, current_period: 3, clock: "5:42",
      })}\n\n`,
    );
  });

  it("skips notifications whose eventid does not match this league (partial is null)", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    mockGetLiveGamePartial.mockResolvedValueOnce(null);
    await mockSubscribe._cb({ channel: "game_updated", payload: "999999" });

    const dataWrites = res.write.mock.calls
      .map((c) => c[0])
      .filter((w) => typeof w === "string" && w.startsWith("data:"));
    expect(dataWrites).toHaveLength(0);
  });

  it("never emits an event: done message", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    mockGetLiveGamePartial.mockResolvedValueOnce({
      id: 1, status: "Final", homescore: 100, awayscore: 99, current_period: 4, clock: "0:00",
    });
    await mockSubscribe._cb({ channel: "game_updated", payload: "1" });

    const writes = res.write.mock.calls.map((c) => c[0]);
    expect(writes.some((w) => typeof w === "string" && w.includes("event: done"))).toBe(false);
    expect(res.end).not.toHaveBeenCalled();
  });

  it("starts the heartbeat after subscribing", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    res.write.mockClear();
    jest.advanceTimersByTime(15_000);
    expect(res.write).toHaveBeenCalledWith(": ping\n\n");
  });

  it("unsubscribes and clears heartbeat when the request closes", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    await req._trigger("close");
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("swallows handler errors and unsubscribes", async () => {
    const req = makeReq("nba");
    const res = makeRes();
    await streamGames(req, res);

    mockGetLiveGamePartial.mockRejectedValueOnce(new Error("db down"));
    await mockSubscribe._cb({ channel: "game_updated", payload: "1" });

    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- liveController`
Expected: FAIL — current `streamGames` calls `getGames(league, { live: true })`, doesn't import `getLiveGamePartial`, emits initial slate, etc. Most of the assertions will fail.

- [ ] **Step 3: Rewrite `streamGames`**

Replace the contents of `backend/src/controllers/games/liveController.js` with:

```js
import { getLiveGamePartial } from "../../services/games/gamesService.js";
import { getNbaGame, getNflGame, getNhlGame } from "../../services/games/gameDetailService.js";
import { subscribe, unsubscribe } from "../../db/notificationBus.js";
import logger from "../../logger.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];
const HEARTBEAT_INTERVAL_MS = 15_000;

const leagueHandlers = {
  nba: getNbaGame,
  nfl: getNflGame,
  nhl: getNhlGame,
};

function setSSEHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 30000\n\n");
}

export async function streamGames(req, res) {
  const { league } = req.params;
  const lcLeague = league?.toLowerCase();
  if (!VALID_LEAGUES.includes(lcLeague)) {
    return res.status(400).json({ error: "Invalid league" });
  }

  setSSEHeaders(res);

  let heartbeat;

  async function onNotification(msg) {
    if (res.writableEnded) return;
    const eventid = msg?.payload;
    if (!eventid) return;
    try {
      const partial = await getLiveGamePartial(lcLeague, eventid);
      if (res.writableEnded) return;
      if (!partial) return; // wrong league / unknown eventid
      res.write(`data: ${JSON.stringify(partial)}\n\n`);
    } catch (err) {
      logger.error({ err }, "SSE streamGames notification error");
      cleanup();
      if (!res.writableEnded) res.end();
    }
  }

  async function cleanup() {
    clearInterval(heartbeat);
    await unsubscribe(onNotification);
  }

  await subscribe(onNotification);

  heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  req.on("close", cleanup);
}

export async function streamGame(req, res) {
  const { league, gameId } = req.params;
  if (!VALID_LEAGUES.includes(league?.toLowerCase())) {
    return res.status(400).json({ error: "Invalid league" });
  }

  if (Number.isNaN(parseInt(gameId, 10))) {
    return res.status(400).json({ error: "Invalid game ID" });
  }

  const handler = leagueHandlers[league.toLowerCase()];
  setSSEHeaders(res);

  let heartbeat;

  async function send() {
    if (res.writableEnded) return;
    try {
      const game = await handler(gameId);
      if (res.writableEnded) return;
      if (!game) {
        res.write("event: done\ndata: final\n\n");
        cleanup();
        res.end();
        return;
      }
      res.write(`data: ${JSON.stringify(game)}\n\n`);
      const status = game.json_build_object?.game?.status ?? "";
      if (status.includes("Final")) {
        res.write("event: done\ndata: final\n\n");
        cleanup();
        res.end();
      }
    } catch (err) {
      logger.error({ err }, "SSE streamGame error");
      cleanup();
      if (!res.writableEnded) res.end();
    }
  }

  async function cleanup() {
    clearInterval(heartbeat);
    await unsubscribe(send);
  }

  await subscribe(send);

  await send();
  if (res.writableEnded) { await cleanup(); return; }

  heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  req.on("close", cleanup);
}
```

Note: `streamGame` (per-game stream) is intentionally unchanged. Only `streamGames` was modified, and the unused `getGames` import + `isTerminalStatus` helper were removed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- liveController`
Expected: PASS — all 9 new tests green.

- [ ] **Step 5: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: PASS — no regressions.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/games/liveController.js backend/__tests__/controllers/games/liveController.test.js
git commit -m "feat(live): emit per-game partials from streamGames using pg_notify eventid"
```

---

## Task 3: Frontend — `sharedSSE` accumulator option

**Files:**
- Modify: `frontend/src/hooks/live/sharedSSE.js`
- Modify: `frontend/src/__tests__/hooks/sharedSSE.test.js`

Add an optional `accumulate(prev, next) => merged` to the `subscribeSSE` options. When provided, sharedSSE applies it on each incoming message (and on each polling-fallback fetch) and stores the accumulated value in `state.lastSnapshot.data`. Late subscribers replay the accumulated state, not just the most recent raw payload.

The accumulator runs **before** the throttle, so within a 1-second throttle window all messages still aggregate into the latest snapshot.

- [ ] **Step 1: Write the failing tests**

Append inside `describe("sharedSSE", ...)` in `frontend/src/__tests__/hooks/sharedSSE.test.js`:

```js
  describe("accumulate option", () => {
    it("applies accumulate(prev, next) to each message and stores accumulated data", async () => {
      vi.useFakeTimers();
      const accumulate = (prev, patch) => {
        const next = new Map(prev ?? []);
        next.set(patch.id, { ...next.get(patch.id), ...patch });
        return next;
      };
      const snapshots = [];
      subscribeSSE(
        "http://test/acc",
        { fetchFallback: () => Promise.resolve(), accumulate },
        (s) => snapshots.push(s),
      );
      const es = MockEventSource.instances[0];

      es.dispatchMessage({ id: 1, score: 5 });
      await vi.advanceTimersByTimeAsync(1000);
      es.dispatchMessage({ id: 2, score: 7 });
      await vi.advanceTimersByTimeAsync(1000);
      es.dispatchMessage({ id: 1, score: 9 });
      await vi.advanceTimersByTimeAsync(1000);

      const last = snapshots.at(-1).data;
      expect(last).toBeInstanceOf(Map);
      expect(last.get(1)).toEqual({ id: 1, score: 9 });
      expect(last.get(2)).toEqual({ id: 2, score: 7 });
      vi.useRealTimers();
    });

    it("replays accumulated data (not just last message) to late subscribers", async () => {
      vi.useFakeTimers();
      const accumulate = (prev, patch) => {
        const next = new Map(prev ?? []);
        next.set(patch.id, { ...next.get(patch.id), ...patch });
        return next;
      };
      const opts = { fetchFallback: () => Promise.resolve(), accumulate };
      subscribeSSE("http://test/acc", opts, () => {});
      const es = MockEventSource.instances[0];

      es.dispatchMessage({ id: 1, score: 5 });
      await vi.advanceTimersByTimeAsync(1000);
      es.dispatchMessage({ id: 2, score: 7 });
      await vi.advanceTimersByTimeAsync(1000);

      const lateSnapshots = [];
      subscribeSSE("http://test/acc", opts, (s) => lateSnapshots.push(s));

      const replayed = lateSnapshots[0].data;
      expect(replayed).toBeInstanceOf(Map);
      expect(replayed.size).toBe(2);
      expect(replayed.get(1)).toEqual({ id: 1, score: 5 });
      expect(replayed.get(2)).toEqual({ id: 2, score: 7 });
      vi.useRealTimers();
    });

    it("runs polling-fallback results through accumulate too", async () => {
      vi.useFakeTimers();
      const accumulate = (prev, patch) => {
        const next = new Map(prev ?? []);
        // Polling returns a Map, so iterate and merge.
        if (patch instanceof Map) {
          for (const [k, v] of patch) next.set(k, { ...next.get(k), ...v });
        } else {
          next.set(patch.id, { ...next.get(patch.id), ...patch });
        }
        return next;
      };
      const fallbackMap = new Map([[1, { id: 1, score: 11 }]]);
      const fetchFallback = vi.fn().mockResolvedValue(fallbackMap);

      const snapshots = [];
      subscribeSSE("http://test/acc", { fetchFallback, accumulate }, (s) =>
        snapshots.push(s),
      );
      const es = MockEventSource.instances[0];
      es.dispatchError();
      es.dispatchError();
      es.dispatchError();

      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.resolve();

      const last = snapshots.at(-1).data;
      expect(last).toBeInstanceOf(Map);
      expect(last.get(1)).toEqual({ id: 1, score: 11 });
      vi.useRealTimers();
    });

    it("falls back to raw payload when no accumulate option provided (existing behavior)", async () => {
      vi.useFakeTimers();
      const snapshots = [];
      subscribeSSE("http://test/raw", { fetchFallback: () => Promise.resolve() }, (s) =>
        snapshots.push(s),
      );
      MockEventSource.instances[0].dispatchMessage([{ id: 1 }]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(snapshots.find((s) => s.data !== undefined).data).toEqual([{ id: 1 }]);
      vi.useRealTimers();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- sharedSSE`
Expected: FAIL on the first three new tests (`accumulate` option not respected); the last test (raw fallback) should pass.

- [ ] **Step 3: Implement the accumulator option**

Modify `frontend/src/hooks/live/sharedSSE.js`. Update the relevant sections:

In `openConnection`, change `es.onmessage`:

```js
  es.onmessage = (event) => {
    state.failureCount = 0;
    try {
      const parsed = JSON.parse(event.data);
      const next = state.accumulate
        ? state.accumulate(state.lastSnapshot?.data, parsed)
        : parsed;
      state.pendingPayload = next;
      if (!state.throttleTimer) {
        state.throttleTimer = setTimeout(() => {
          if (state.pendingPayload !== null) {
            broadcast(state, { data: state.pendingPayload });
            state.pendingPayload = null;
          }
          state.throttleTimer = null;
        }, THROTTLE_MS);
      }
    } catch {
      // ignore parse errors
    }
  };
```

In `startPollingFallback`, push fallback results through the same accumulator:

```js
function startPollingFallback(state) {
  broadcast(state, { streamError: true, isStreaming: false });
  state.pollTimer = setInterval(async () => {
    try {
      const raw = await state.fetchFallback();
      const next = state.accumulate
        ? state.accumulate(state.lastSnapshot?.data, raw)
        : raw;
      broadcast(state, { data: next });
    } catch {
      // silently continue
    }
  }, POLL_INTERVAL_MS);
}
```

In `subscribeSSE`, accept and store the option:

```js
export function subscribeSSE(url, { fetchFallback, accumulate }, listener) {
  let state = clients.get(url);

  if (!state) {
    state = {
      es: null,
      listeners: new Set(),
      lastSnapshot: {},
      fetchFallback,
      accumulate,
      failureCount: 0,
      pollTimer: null,
      throttleTimer: null,
      pendingPayload: null,
      done: false,
      lastReconnectAt: 0,
    };
    clients.set(url, state);
    state.listeners.add(listener);
    openConnection(url, state);
    broadcast(state, { isStreaming: true });
  } else {
    state.listeners.add(listener);
    // Replay cached snapshot synchronously so late subscribers don't see
    // initial-null flicker before the next SSE tick.
    if (Object.keys(state.lastSnapshot).length > 0) {
      listener(state.lastSnapshot);
    }
  }

  return function unsubscribe() {
    const current = clients.get(url);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      teardown(url, current);
    }
  };
}
```

(Note: only the first subscriber's `accumulate` is captured. This matches `fetchFallback`'s existing behavior — both are URL-scoped, not subscriber-scoped. All callers for a given URL must agree.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- sharedSSE`
Expected: PASS — all 4 new tests + all 14 existing tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/live/sharedSSE.js frontend/src/__tests__/hooks/sharedSSE.test.js
git commit -m "feat(sse): add accumulate option for stateful SSE streams"
```

---

## Task 4: Frontend — `useLiveGames` returns `liveGamesMap`

**Files:**
- Modify: `frontend/src/hooks/live/useLiveGames.js`
- Modify: `frontend/src/__tests__/hooks/useLiveGames.test.js`

`useLiveGames(league)` now returns `{ liveGamesMap: Map<id, partial>, streamError }` instead of `{ liveGames: Game[], streamError }`. The accumulator merges per-id partials into a Map.

The polling-fallback `getLeagueGames(league)` still returns a full `Game[]`. We project each row to the volatile-fields shape and accumulate into the same Map.

- [ ] **Step 1: Update existing tests for the new shape**

Open `frontend/src/__tests__/hooks/useLiveGames.test.js`. Replace these tests in place (rest of the file stays):

Replace the `liveGames` assertion in `"does nothing when league is null"`:

```js
  it("does nothing when league is null", () => {
    const { result } = renderHook(() => useLiveGames(null));
    expect(MockEventSource.instances).toHaveLength(0);
    expect(result.current.liveGamesMap).toBeNull();
  });
```

Replace `"updates liveGames state on message event"` with:

```js
  it("accumulates partials into liveGamesMap on message events", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveGames("nba"));

    await act(async () => {
      MockEventSource.instances[0].dispatchMessage({ id: 1, status: "In Progress", homescore: 10, awayscore: 8 });
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.liveGamesMap).toBeInstanceOf(Map);
    expect(result.current.liveGamesMap.get(1)).toMatchObject({ id: 1, status: "In Progress", homescore: 10 });

    await act(async () => {
      MockEventSource.instances[0].dispatchMessage({ id: 2, status: "In Progress", homescore: 0, awayscore: 0 });
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.liveGamesMap.size).toBe(2);
    expect(result.current.liveGamesMap.get(2).status).toBe("In Progress");

    // Subsequent partial for id=1 merges in (not replaces wholesale).
    await act(async () => {
      MockEventSource.instances[0].dispatchMessage({ id: 1, homescore: 12 });
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.liveGamesMap.get(1)).toMatchObject({ id: 1, status: "In Progress", homescore: 12, awayscore: 8 });
    vi.useRealTimers();
  });
```

Replace `"falls back to REST polling after 3 consecutive errors"`:

```js
  it("projects fetchFallback Game[] into liveGamesMap on REST polling fallback", async () => {
    vi.useFakeTimers();
    const fallbackGames = [{
      id: 1, status: "In Progress", homescore: 10, awayscore: 8, current_period: 2, clock: "5:00", date: "2026-05-10",
    }];
    getLeagueGames.mockResolvedValue(fallbackGames);

    const { result } = renderHook(() => useLiveGames("nba"));
    const es = MockEventSource.instances[0];

    await act(async () => {
      es.dispatchError(); es.dispatchError(); es.dispatchError();
    });
    expect(result.current.streamError).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await act(async () => {});

    expect(getLeagueGames).toHaveBeenCalledWith("nba");
    expect(result.current.liveGamesMap).toBeInstanceOf(Map);
    expect(result.current.liveGamesMap.get(1)).toMatchObject({
      id: 1, status: "In Progress", homescore: 10, awayscore: 8, current_period: 2, clock: "5:00",
    });
    vi.useRealTimers();
  });
```

Replace `"resets failure count on successful message"`:

```js
  it("resets failure count on successful message", async () => {
    const partial = { id: 1, status: "In Progress" };
    renderHook(() => useLiveGames("nba"));
    const es = MockEventSource.instances[0];

    act(() => {
      es.dispatchError();
      es.dispatchError();
      es.dispatchMessage(partial);
      es.dispatchError(); // failure count resets so this is only 1
    });

    expect(getLeagueGames).not.toHaveBeenCalled();
  });
```

Replace `"fans out a single message to all subscribers"`:

```js
  it("fans out a single partial to all subscribers", async () => {
    vi.useFakeTimers();
    const partial = { id: 1, status: "In Progress" };
    const a = renderHook(() => useLiveGames("nba"));
    const b = renderHook(() => useLiveGames("nba"));

    await act(async () => {
      MockEventSource.instances[0].dispatchMessage(partial);
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(a.result.current.liveGamesMap.get(1)).toMatchObject(partial);
    expect(b.result.current.liveGamesMap.get(1)).toMatchObject(partial);
    vi.useRealTimers();
  });
```

Replace `"replays cached snapshot to late subscribers synchronously"`:

```js
  it("replays accumulated map to late subscribers synchronously", async () => {
    vi.useFakeTimers();
    const partial = { id: 1, status: "In Progress" };

    renderHook(() => useLiveGames("nba"));
    await act(async () => {
      MockEventSource.instances[0].dispatchMessage(partial);
      await vi.advanceTimersByTimeAsync(1000);
    });

    const late = renderHook(() => useLiveGames("nba"));
    expect(late.result.current.liveGamesMap).toBeInstanceOf(Map);
    expect(late.result.current.liveGamesMap.get(1)).toMatchObject(partial);
    vi.useRealTimers();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- useLiveGames`
Expected: FAIL — `liveGamesMap` is undefined; hook still returns `liveGames` array.

- [ ] **Step 3: Rewrite `useLiveGames`**

Replace `frontend/src/hooks/live/useLiveGames.js` with:

```js
import { useState, useEffect } from "react";
import { getLiveGamesUrl, getLeagueGames } from "../../api/games.js";
import { useVisibilityReconnect } from "./useVisibilityReconnect.js";
import { subscribeSSE, forceReconnect } from "./sharedSSE.js";

const VOLATILE_FIELDS = ["id", "status", "homescore", "awayscore", "current_period", "clock"];

function projectVolatile(row) {
  const out = {};
  for (const k of VOLATILE_FIELDS) out[k] = row[k];
  return out;
}

function accumulate(prev, next) {
  const map = new Map(prev ?? []);
  if (Array.isArray(next)) {
    // fetchFallback path — full Game[] from REST.
    for (const row of next) {
      if (row?.id == null) continue;
      const partial = projectVolatile(row);
      map.set(row.id, { ...map.get(row.id), ...partial });
    }
  } else if (next && typeof next === "object" && next.id != null) {
    map.set(next.id, { ...map.get(next.id), ...next });
  }
  return map;
}

export function useLiveGames(league) {
  const [liveGamesMap, setLiveGamesMap] = useState(null);
  const [streamError, setStreamError] = useState(false);

  useVisibilityReconnect(() => {
    if (league) forceReconnect(getLiveGamesUrl(league));
  }, !!league);

  useEffect(() => {
    if (!league) {
      setLiveGamesMap(null);
      setStreamError(false);
      return undefined;
    }
    const url = getLiveGamesUrl(league);
    return subscribeSSE(
      url,
      {
        fetchFallback: () => getLeagueGames(league),
        accumulate,
      },
      ({ data, streamError: e }) => {
        if (data !== undefined) setLiveGamesMap(data);
        if (e !== undefined) setStreamError(e);
      },
    );
  }, [league]);

  return { liveGamesMap, streamError };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- useLiveGames`
Expected: PASS — all updated tests + all unchanged tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/live/useLiveGames.js frontend/src/__tests__/hooks/useLiveGames.test.js
git commit -m "refactor(live): useLiveGames returns liveGamesMap with accumulated partials"
```

---

## Task 5: Frontend — `useHomeGames` merge by id

**Files:**
- Modify: `frontend/src/hooks/data/useHomeGames.js:35-47`
- Modify: `frontend/src/__tests__/hooks/useHomeGames.test.js`

The `hasActiveGame` REST gate is unchanged. The SSE-merge effect switches from wholesale array replacement to per-id merge. The `useLiveGames` mock now returns `liveGamesMap`.

- [ ] **Step 1: Update existing tests**

Open `frontend/src/__tests__/hooks/useHomeGames.test.js`. Update the default mock return value in `beforeEach`:

```js
beforeEach(() => {
  vi.clearAllMocks();
  useLiveGames.mockReturnValue({ liveGamesMap: null });
});
```

Replace the `"updates games with liveGames data when available"` test with:

```js
  it("merges liveGamesMap partials into games by id, preserving non-live rows", async () => {
    const initial = {
      nba: [
        { id: 1, status: "Final", homescore: 100, awayscore: 99, home_team_name: "Lakers" },
        { id: 2, status: "In Progress", homescore: 50, awayscore: 48, home_team_name: "Suns" },
      ],
      nhl: [{ id: 10, status: "Final", home_team_name: "Bruins" }],
      nfl: [{ id: 20, status: "Final", home_team_name: "49ers" }],
    };
    getAllLeagueGames.mockResolvedValue(initial);
    useLiveGames.mockReturnValue({ liveGamesMap: null });

    const { result, rerender } = renderHook(() => useHomeGames(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const liveNbaMap = new Map([
      [2, { id: 2, status: "In Progress - Q3", homescore: 55, awayscore: 51, current_period: 3, clock: "5:42" }],
    ]);
    useLiveGames.mockReturnValue({ liveGamesMap: liveNbaMap });
    rerender();

    await waitFor(() => {
      const updated = result.current.games.nba.find((g) => g.id === 2);
      return updated.status === "In Progress - Q3" && updated.homescore === 55;
    });
    // Non-live row untouched (Final)
    expect(result.current.games.nba.find((g) => g.id === 1)).toMatchObject({
      id: 1, status: "Final", homescore: 100, home_team_name: "Lakers",
    });
    // Merged row keeps non-volatile field (home_team_name)
    expect(result.current.games.nba.find((g) => g.id === 2)).toMatchObject({
      id: 2, status: "In Progress - Q3", homescore: 55, home_team_name: "Suns",
    });
  });

  it("ignores partials whose id is not in the slate", async () => {
    const initial = {
      nba: [{ id: 1, status: "Final" }],
      nhl: [],
      nfl: [],
    };
    getAllLeagueGames.mockResolvedValue(initial);
    useLiveGames.mockReturnValue({ liveGamesMap: null });

    const { result, rerender } = renderHook(() => useHomeGames(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    useLiveGames.mockReturnValue({
      liveGamesMap: new Map([[999, { id: 999, status: "In Progress" }]]),
    });
    rerender();

    // Slate untouched.
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.games.nba).toEqual([{ id: 1, status: "Final" }]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- useHomeGames`
Expected: FAIL — current code reads `liveNba` (array) and replaces wholesale; tests now feed a Map.

- [ ] **Step 3: Update `useHomeGames`**

Replace `frontend/src/hooks/data/useHomeGames.js` with:

```js
import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllLeagueGames } from "../../api/games.js";
import { useLiveGames } from "../live/useLiveGames.js";
import { useVisibilityReconnect } from "../live/useVisibilityReconnect.js";
import { queryKeys } from "../../lib/query.js";

function hasActiveGame(games) {
  return games.some((g) => {
    const s = g.status ?? "";
    const isTerminal =
      s.includes("Final") ||
      s.includes("Postponed") ||
      s.includes("Canceled") ||
      s.includes("Cancelled") ||
      s.includes("Suspended");
    return !isTerminal && s.length > 0;
  });
}

function mergeByMap(arr, map) {
  if (!map || map.size === 0) return arr;
  return arr.map((g) => (map.has(g.id) ? { ...g, ...map.get(g.id) } : g));
}

export function useHomeGames() {
  const queryClient = useQueryClient();

  const {
    data: games = { nba: [], nhl: [], nfl: [] },
    isLoading: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.homeGames(),
    queryFn: ({ signal }) => getAllLeagueGames(signal),
    staleTime: 0,
  });

  const { liveGamesMap: liveNbaMap } = useLiveGames(hasActiveGame(games.nba) ? "nba" : null);
  const { liveGamesMap: liveNhlMap } = useLiveGames(hasActiveGame(games.nhl) ? "nhl" : null);
  const { liveGamesMap: liveNflMap } = useLiveGames(hasActiveGame(games.nfl) ? "nfl" : null);

  useEffect(() => {
    if (!liveNbaMap && !liveNhlMap && !liveNflMap) return;
    queryClient.setQueryData(queryKeys.homeGames(), (prev) => {
      if (!prev) return prev;
      return {
        nba: mergeByMap(prev.nba, liveNbaMap),
        nhl: mergeByMap(prev.nhl, liveNhlMap),
        nfl: mergeByMap(prev.nfl, liveNflMap),
      };
    });
  }, [liveNbaMap, liveNhlMap, liveNflMap, queryClient]);

  useVisibilityReconnect(() => {
    refetch();
  });

  const error = isError ? "Could not load games. Please try again later." : null;

  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  return { games, loading, error, retry, refetch };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- useHomeGames`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/data/useHomeGames.js frontend/src/__tests__/hooks/useHomeGames.test.js
git commit -m "refactor(home): useHomeGames merges live partials by id"
```

---

## Task 6: Frontend — `useLeagueData` merge by id

**Files:**
- Modify: `frontend/src/hooks/data/useLeagueData.js:75-98`
- Modify: `frontend/src/__tests__/hooks/useLeagueData.test.js`

The date-filter step in the SSE effect goes away — partials are keyed by `games.id`, so any update for an id already in the slate is by definition for that slate. Future-date rows can no longer leak in (they'd never have made it into the REST snapshot).

- [ ] **Step 1: Update existing tests**

Open `frontend/src/__tests__/hooks/useLeagueData.test.js`.

Update the default mock in `beforeEach`:

```js
beforeEach(() => {
  vi.clearAllMocks();
  getLeagueGames.mockResolvedValue([]);
  getStandings.mockResolvedValue([]);
  useLiveGames.mockReturnValue({ liveGamesMap: null });
});
```

**Delete** the entire `describe("useLeagueData — SSE payload filter", () => { ... })` block (it tests the removed date-filter behavior).

**Add** a new describe block in its place:

```js
describe("useLeagueData — SSE merge by id", () => {
  it("merges liveGamesMap partials into games by id, keeping non-live rows", async () => {
    const todayET = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    getLeagueGames.mockResolvedValue({
      games: [
        { id: 1, status: "In Progress", homescore: 50, awayscore: 48, home_team_name: "Suns" },
        { id: 2, status: "Final", homescore: 100, awayscore: 99, home_team_name: "Lakers" },
      ],
      resolvedDate: todayET,
      resolvedSeason: "2025-26",
    });
    useLiveGames.mockReturnValue({
      liveGamesMap: new Map([
        [1, { id: 1, status: "In Progress - Q3", homescore: 55, awayscore: 51, current_period: 3, clock: "5:42" }],
      ]),
    });

    const { result } = renderHook(() => useLeagueData("nba", null, todayET), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const live = result.current.games.find((g) => g.id === 1);
      return live?.status === "In Progress - Q3" && live?.homescore === 55;
    });
    // Non-volatile field preserved on the merged row
    expect(result.current.games.find((g) => g.id === 1)).toMatchObject({
      id: 1, home_team_name: "Suns", current_period: 3, clock: "5:42",
    });
    // Final row untouched
    expect(result.current.games.find((g) => g.id === 2)).toMatchObject({
      id: 2, status: "Final", homescore: 100, home_team_name: "Lakers",
    });
  });

  it("ignores partials whose id is not in the slate", async () => {
    const todayET = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    getLeagueGames.mockResolvedValue([{ id: 1, status: "Final" }]);
    useLiveGames.mockReturnValue({
      liveGamesMap: new Map([[999, { id: 999, status: "In Progress" }]]),
    });

    const { result } = renderHook(() => useLeagueData("nba", null, null), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.displayData).toBe(true));

    expect(result.current.games).toEqual([{ id: 1, status: "Final" }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- useLeagueData`
Expected: FAIL — hook still expects `liveGames` array.

- [ ] **Step 3: Update `useLeagueData`**

In `frontend/src/hooks/data/useLeagueData.js`, change two sections.

Add a merge helper after `hasActiveGame`:

```js
function mergeByMap(arr, map) {
  if (!map || map.size === 0) return arr;
  return arr.map((g) => (map.has(g.id) ? { ...g, ...map.get(g.id) } : g));
}
```

Replace the SSE block (the `useLiveGames` call and the `useEffect` that follows it) with:

```js
  const { liveGamesMap } = useLiveGames(sseLeague);

  useEffect(() => {
    if (!liveGamesMap || !sseLeague) return;
    queryClient.setQueryData(
      queryKeys.leagueGames(league, selectedSeason, selectedDate),
      (prev) => {
        if (!prev) return prev;
        if (Array.isArray(prev)) return mergeByMap(prev, liveGamesMap);
        return { ...prev, games: mergeByMap(prev.games ?? [], liveGamesMap) };
      },
    );
  }, [liveGamesMap, sseLeague, queryClient, league, selectedSeason, selectedDate]);
```

(Remove the `selectedDate`-based filter on `payload`; remove the `resolvedDate` and `resolvedSeason` from the deps since the merger no longer reads them.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- useLeagueData`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/data/useLeagueData.js frontend/src/__tests__/hooks/useLeagueData.test.js
git commit -m "refactor(league): useLeagueData merges live partials by id"
```

---

## Task 7: Frontend — `useSlateGames` merge by id

**Files:**
- Modify: `frontend/src/hooks/data/useSlateGames.js:42-57`
- Modify: `frontend/src/__tests__/hooks/useSlateGames.test.js`

Same merge pattern. The `slateDate` filter goes away (no future-date rows to filter — partials are keyed by id only).

- [ ] **Step 1: Update existing tests**

Open `frontend/src/__tests__/hooks/useSlateGames.test.js`.

Update the default mock in `beforeEach`:

```js
beforeEach(() => {
  vi.clearAllMocks();
  useLiveGames.mockReturnValue({ liveGamesMap: null });
});
```

Add a new test at the bottom of `describe("useSlateGames", ...)`:

```js
  it("merges liveGamesMap partials into games by id", async () => {
    getLeagueGames.mockResolvedValue({
      games: [
        { id: 1, status: "In Progress", homescore: 50, awayscore: 48, home_team_name: "Suns" },
        { id: 2, status: "Final", homescore: 100, awayscore: 99 },
      ],
      resolvedDate: "2026-05-02",
    });
    useLiveGames.mockReturnValue({
      liveGamesMap: new Map([
        [1, { id: 1, status: "In Progress - Q3", homescore: 55, awayscore: 51, current_period: 3, clock: "5:42" }],
      ]),
    });

    const { result } = renderHook(() => useSlateGames("nba"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const live = result.current.games.find((g) => g.id === 1);
      return live?.status === "In Progress - Q3" && live?.homescore === 55;
    });
    expect(result.current.games.find((g) => g.id === 1)).toMatchObject({
      id: 1, home_team_name: "Suns", current_period: 3,
    });
    expect(result.current.games.find((g) => g.id === 2)).toMatchObject({
      id: 2, status: "Final", homescore: 100,
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- useSlateGames`
Expected: FAIL — hook expects `liveGames` array.

- [ ] **Step 3: Update `useSlateGames`**

Replace the SSE-merge effect in `frontend/src/hooks/data/useSlateGames.js`. Replace lines 43-57 (the `const { liveGames } = ...` call through the closing `}, [...])` of the effect) with:

```js
  const { liveGamesMap } = useLiveGames(sseLeague);

  useEffect(() => {
    if (!liveGamesMap || !sseLeague) return;
    queryClient.setQueryData(
      queryKeys.leagueGames(league, null, slateDate),
      (prev) => {
        if (!prev) return prev;
        const arr = Array.isArray(prev) ? prev : prev.games ?? [];
        const merged = arr.map((g) =>
          liveGamesMap.has(g.id) ? { ...g, ...liveGamesMap.get(g.id) } : g
        );
        return Array.isArray(prev) ? merged : { ...prev, games: merged };
      },
    );
  }, [liveGamesMap, sseLeague, queryClient, league, slateDate]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- useSlateGames`
Expected: PASS — new test + all existing tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/data/useSlateGames.js frontend/src/__tests__/hooks/useSlateGames.test.js
git commit -m "refactor(slate): useSlateGames merges live partials by id"
```

---

## Task 8: Frontend — `usePlayerLiveGames` consumes Map

**Files:**
- Modify: `frontend/src/hooks/data/usePlayerLiveGames.js`
- Create: `frontend/src/__tests__/hooks/usePlayerLiveGames.test.js`

Switch from array iteration (`for (const lg of liveGames)`) to Map iteration (`for (const [id, partial] of liveGamesMap)`). The shape of the returned `{[id]: {...volatile}}` object is unchanged — consumers keep working.

- [ ] **Step 1: Write the failing tests (new file)**

Create `frontend/src/__tests__/hooks/usePlayerLiveGames.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../../hooks/live/useLiveGames.js", () => ({ useLiveGames: vi.fn() }));

const { useLiveGames } = await import("../../hooks/live/useLiveGames.js");
const { usePlayerLiveGames } = await import("../../hooks/data/usePlayerLiveGames.js");

beforeEach(() => {
  vi.clearAllMocks();
  useLiveGames.mockReturnValue({ liveGamesMap: null });
});

describe("usePlayerLiveGames", () => {
  it("returns empty object when player has no games", () => {
    const { result } = renderHook(() => usePlayerLiveGames("nba", []));
    expect(result.current).toEqual({});
  });

  it("does NOT subscribe to SSE when none of the player's games are live", () => {
    const games = [{ gameid: 1, status: "Final" }, { gameid: 2, status: "Scheduled" }];
    renderHook(() => usePlayerLiveGames("nba", games));
    expect(useLiveGames).toHaveBeenCalledWith(null);
  });

  it("subscribes to SSE when at least one of the player's games is live", () => {
    const games = [{ gameid: 1, status: "Final" }, { gameid: 2, status: "In Progress" }];
    renderHook(() => usePlayerLiveGames("nba", games));
    expect(useLiveGames).toHaveBeenCalledWith("nba");
  });

  it("returns volatile fields keyed by gameid for ids in the player's game set", () => {
    const games = [{ gameid: 5, status: "In Progress" }, { gameid: 7, status: "Final" }];
    useLiveGames.mockReturnValue({
      liveGamesMap: new Map([
        [5, { id: 5, status: "In Progress - Q3", homescore: 55, awayscore: 51, current_period: 3, clock: "5:42" }],
        [99, { id: 99, status: "In Progress" }], // not in the player's game set — ignored
      ]),
    });

    const { result } = renderHook(() => usePlayerLiveGames("nba", games));
    expect(Object.keys(result.current)).toEqual(["5"]);
    expect(result.current[5]).toMatchObject({
      status: "In Progress - Q3", homescore: 55, awayscore: 51, current_period: 3, clock: "5:42",
    });
  });

  it("returns empty object when liveGamesMap is null", () => {
    const games = [{ gameid: 1, status: "In Progress" }];
    useLiveGames.mockReturnValue({ liveGamesMap: null });
    const { result } = renderHook(() => usePlayerLiveGames("nba", games));
    expect(result.current).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- usePlayerLiveGames`
Expected: FAIL — hook still iterates array `liveGames`, returns nothing useful given a Map.

- [ ] **Step 3: Rewrite `usePlayerLiveGames`**

Replace `frontend/src/hooks/data/usePlayerLiveGames.js` with:

```js
import { useMemo } from "react";
import { useLiveGames } from "../live/useLiveGames.js";

function isLiveStatus(status) {
  if (!status) return false;
  return (
    status.includes("In Progress") ||
    status.includes("Halftime") ||
    status.includes("End of Period")
  );
}

// Builds a map of { [gameId]: { status, current_period, clock, homescore, awayscore } }
// using live SSE updates. The SSE subscription only opens when at least one of
// the player's games is currently in progress.
export function usePlayerLiveGames(league, games) {
  const hasLive = useMemo(
    () => Array.isArray(games) && games.some((g) => isLiveStatus(g.status)),
    [games],
  );
  const { liveGamesMap } = useLiveGames(hasLive ? league : null);

  return useMemo(() => {
    if (!liveGamesMap || liveGamesMap.size === 0) return {};
    const ids = new Set(
      (games || []).map((g) => g.gameid).filter((id) => id != null),
    );
    const map = {};
    for (const [id, partial] of liveGamesMap) {
      if (!ids.has(id)) continue;
      map[id] = {
        status: partial.status,
        current_period: partial.current_period,
        clock: partial.clock,
        homescore: partial.homescore,
        awayscore: partial.awayscore,
      };
    }
    return map;
  }, [liveGamesMap, games]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- usePlayerLiveGames`
Expected: PASS — all 5 new tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/data/usePlayerLiveGames.js frontend/src/__tests__/hooks/usePlayerLiveGames.test.js
git commit -m "refactor(player): usePlayerLiveGames consumes liveGamesMap"
```

---

## Task 9: Frontend — `useTeamNextGame` consumes Map

**Files:**
- Modify: `frontend/src/hooks/data/useTeamNextGame.js`
- Create: `frontend/src/__tests__/hooks/useTeamNextGame.test.js`

Switch from `liveGames.find(g => g.id === game.id)` to `liveGamesMap.get(game.id)`.

- [ ] **Step 1: Write the failing tests (new file)**

Create `frontend/src/__tests__/hooks/useTeamNextGame.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/teams.js", () => ({ getTeamNextGame: vi.fn() }));
vi.mock("../../hooks/live/useLiveGames.js", () => ({ useLiveGames: vi.fn() }));

const { getTeamNextGame } = await import("../../api/teams.js");
const { useLiveGames } = await import("../../hooks/live/useLiveGames.js");
const { useTeamNextGame } = await import("../../hooks/data/useTeamNextGame.js");

beforeEach(() => {
  vi.clearAllMocks();
  useLiveGames.mockReturnValue({ liveGamesMap: null });
});

describe("useTeamNextGame", () => {
  it("returns the next game from the REST query", async () => {
    getTeamNextGame.mockResolvedValue({
      kind: "scheduled", id: 5, status: "Scheduled", isHome: true,
    });
    const { result } = renderHook(() => useTeamNextGame("nba", 13), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.nextGame).toMatchObject({ kind: "scheduled", id: 5 });
  });

  it("does NOT subscribe to SSE when next game is scheduled (not live)", async () => {
    getTeamNextGame.mockResolvedValue({
      kind: "scheduled", id: 5, status: "Scheduled", isHome: true,
    });
    renderHook(() => useTeamNextGame("nba", 13), { wrapper: createWrapper() });
    await waitFor(() => expect(getTeamNextGame).toHaveBeenCalled());
    expect(useLiveGames).toHaveBeenCalledWith(null);
  });

  it("subscribes to SSE when next game is live", async () => {
    getTeamNextGame.mockResolvedValue({
      kind: "live", id: 5, status: "In Progress", isHome: true,
      teamScore: 50, opponentScore: 48,
    });
    renderHook(() => useTeamNextGame("nba", 13), { wrapper: createWrapper() });
    await waitFor(() => {
      expect(useLiveGames.mock.calls.some((c) => c[0] === "nba")).toBe(true);
    });
  });

  it("patches the live cache entry from liveGamesMap.get(id)", async () => {
    getTeamNextGame.mockResolvedValue({
      kind: "live", id: 5, status: "In Progress", isHome: true,
      teamScore: 50, opponentScore: 48, currentPeriod: 2, clock: "10:00",
    });

    const { result, rerender } = renderHook(() => useTeamNextGame("nba", 13), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.nextGame?.kind).toBe("live"));

    useLiveGames.mockReturnValue({
      liveGamesMap: new Map([
        [5, { id: 5, status: "In Progress - Q3", homescore: 60, awayscore: 55, current_period: 3, clock: "5:42" }],
      ]),
    });
    rerender();

    await waitFor(() => {
      const ng = result.current.nextGame;
      return ng?.status === "In Progress - Q3"
        && ng?.teamScore === 60        // isHome=true so teamScore = homescore
        && ng?.opponentScore === 55
        && ng?.currentPeriod === 3
        && ng?.clock === "5:42";
    });
  });

  it("invalidates the query when the live game flips to Final", async () => {
    getTeamNextGame.mockResolvedValue({
      kind: "live", id: 5, status: "In Progress", isHome: true,
      teamScore: 50, opponentScore: 48,
    });

    const { result, rerender } = renderHook(() => useTeamNextGame("nba", 13), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.nextGame?.kind).toBe("live"));

    // Subsequent fetch (after invalidate) returns the next scheduled game.
    getTeamNextGame.mockResolvedValue({
      kind: "scheduled", id: 6, status: "Scheduled", isHome: false,
    });

    useLiveGames.mockReturnValue({
      liveGamesMap: new Map([
        [5, { id: 5, status: "Final", homescore: 100, awayscore: 99 }],
      ]),
    });
    rerender();

    await waitFor(() => expect(result.current.nextGame?.id).toBe(6));
    expect(getTeamNextGame).toHaveBeenCalledTimes(2);
  });

  it("ignores partials whose id is not the current next game's id", async () => {
    getTeamNextGame.mockResolvedValue({
      kind: "live", id: 5, status: "In Progress", isHome: true,
      teamScore: 50, opponentScore: 48,
    });

    const { result, rerender } = renderHook(() => useTeamNextGame("nba", 13), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.nextGame?.kind).toBe("live"));

    useLiveGames.mockReturnValue({
      liveGamesMap: new Map([[999, { id: 999, status: "In Progress" }]]),
    });
    rerender();

    // Wait a tick — nothing should change.
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.nextGame.status).toBe("In Progress");
    expect(result.current.nextGame.teamScore).toBe(50);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- useTeamNextGame`
Expected: FAIL — current code calls `liveGames.find(...)` on the `liveGames` array; `liveGamesMap` does not exist on the hook return.

- [ ] **Step 3: Update `useTeamNextGame`**

Replace `frontend/src/hooks/data/useTeamNextGame.js` with:

```js
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeamNextGame } from "../../api/teams.js";
import { queryKeys } from "../../lib/query.js";
import { useLiveGames } from "../live/useLiveGames.js";

export function useTeamNextGame(league, teamId, { enabled = true } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.teamNextGame(league, teamId),
    queryFn: ({ signal }) => getTeamNextGame(league, teamId, { signal }),
    enabled: !!league && !!teamId && enabled,
    staleTime: 5 * 60 * 1000,
  });

  const game = query.data;
  const isLive = game?.kind === "live";
  const { liveGamesMap } = useLiveGames(isLive ? league : null);

  useEffect(() => {
    if (!isLive || !liveGamesMap || !game?.id) return;
    const fresh = liveGamesMap.get(game.id);
    if (!fresh) return;

    if (fresh.status?.includes("Final")) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.teamNextGame(league, teamId),
      });
      return;
    }

    queryClient.setQueryData(
      queryKeys.teamNextGame(league, teamId),
      (prev) => {
        if (!prev || prev.kind !== "live" || prev.id !== fresh.id) return prev;
        return {
          ...prev,
          status: fresh.status,
          teamScore: prev.isHome ? fresh.homescore : fresh.awayscore,
          opponentScore: prev.isHome ? fresh.awayscore : fresh.homescore,
          currentPeriod: fresh.current_period,
          clock: fresh.clock,
        };
      },
    );
  }, [liveGamesMap, isLive, game?.id, league, teamId, queryClient]);

  return {
    nextGame: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- useTeamNextGame`
Expected: PASS — all 6 new tests green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/data/useTeamNextGame.js frontend/src/__tests__/hooks/useTeamNextGame.test.js
git commit -m "refactor(team): useTeamNextGame consumes liveGamesMap"
```

---

## Task 10: Full verification + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend verify**

Run: `cd frontend && npm run verify`
Expected: PASS — lint + all Vitest tests + production build all green.

- [ ] **Step 2: Run the full backend verify**

Run: `cd backend && npm run verify`
Expected: PASS — lint + all Jest tests green.

- [ ] **Step 3: Manual smoke test — backend SSE wire format**

In one terminal: `cd backend && npm run dev`
In another:
```bash
curl -N http://localhost:3001/api/live/nba/games
```
Expected: SSE headers, then `: ping` heartbeats every ~15s. When a real notify fires (or you can simulate by editing a games row in psql: `UPDATE games SET homescore = homescore WHERE league='nba' LIMIT 1;`), you should see exactly one `data: {"id":...,"status":...,"homescore":...,"awayscore":...,"current_period":...,"clock":...}` line, NOT a 12-game array.

- [ ] **Step 4: Manual smoke test — frontend slate behavior**

Run: `cd frontend && npm run dev`. Open the homepage in a browser. With the network tab open, watch the SSE stream and confirm:
- Initial REST `/api/games/all` returns the slate.
- Subsequent SSE messages are small per-game partials, not full slates.
- Final/Scheduled rows on the homepage stay rendered (don't disappear) as live updates flow.
- Player page (for a player with a live game today) shows score updates ticking.
- Team page (for a team currently playing) updates the next-game card score/clock.

If the dev environment has no live games at this moment, simulate via psql as in Step 3.

- [ ] **Step 5: Final commit / no-op**

If everything passes and no incidental fixes were needed, no further commit. Otherwise commit any small follow-ups separately.

---

## Self-Review Notes (already addressed)

- All five frontend consumers updated; no `liveGames` (array) consumers remain.
- `useLiveGame` (per-game) and `useGame` are intentionally untouched — `streamGame` is a separate controller path.
- `getLiveGamePartial` is the only new backend export; `getGames` API unchanged.
- `event: done` is removed from `streamGames` only; `streamGame` keeps its `done` event (it's a per-game stream and ends when that game finishes).
- The `notificationBus` callback signature is preserved (`(msg) => ...`); only the consumer reads `msg.payload`.
- `accumulate` is keyed by URL (same as `fetchFallback`); first subscriber's value is captured and shared.
