# Global Live-Games Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-league `LeagueSlate` (currently rendered only on `LeaguePage`) with a single global rail mounted in the app layout — sticky on desktop, static on mobile, league scope auto-derived from the URL.

**Architecture:** Extract slate-date utilities into a shared module. Add a lean `useSlateGames(league)` hook (games-only fetch + SSE pump, reuses the existing `leagueGames` cache key). Add `useGlobalSlate(leagueFilter)` orchestrator that delegates to one or three `useSlateGames` calls depending on filter. Replace `LeagueSlate` with `GlobalSlate` in `frontend/src/components/layout/`, mount it in `App.jsx` between `Navbar` and the routed outlet. Remove the inline `LeagueSlate` render from `LeaguePage`.

**Tech Stack:** React 19, TanStack Query v5, Vitest + Testing Library + jsdom (per `frontend/docs/testing.md`), Tailwind v4 with Scorva tokens (`bg-surface-elevated`, `text-text-tertiary`, etc.).

**Reference spec:** `docs/superpowers/specs/2026-05-02-global-live-games-rail-design.md`

---

## File Structure

**Create:**
- `frontend/src/utils/slateDate.js` — `getSlateDateET`, `parseStartTime`, `compactTime`, `statusGroup`, plus a new `resolveLeagueFilter(pathname)` helper used by `App.jsx`
- `frontend/src/hooks/data/useSlateGames.js` — single-league fetcher + SSE pump, returns `{ games, resolvedDate, loading, error }`
- `frontend/src/hooks/data/useGlobalSlate.js` — multi-league orchestrator, returns `{ games, loading, error }` (off-season leagues silently dropped, games tagged with `league` field)
- `frontend/src/components/layout/GlobalSlate.jsx` — replaces `LeagueSlate.jsx`, accepts `leagueFilter` prop, hides on `/about` + `/privacy`
- `frontend/src/__tests__/utilities/slateDate.test.js`
- `frontend/src/__tests__/hooks/useSlateGames.test.js`
- `frontend/src/__tests__/hooks/useGlobalSlate.test.js`
- `frontend/src/__tests__/components/GlobalSlate.test.jsx`

**Modify:**
- `frontend/src/components/skeletons/LeaguePageSkeleton.jsx` — rename `LeagueSlateSkeleton` → `GlobalSlateSkeleton`
- `frontend/src/App.jsx` — import `GlobalSlate`, mount inside `AppShellInner`, resolve `leagueFilter` from `useLocation()`
- `frontend/src/pages/LeaguePage.jsx` — remove `LeagueSlate` import + `showSlate` line + render

**Delete:**
- `frontend/src/components/navigation/LeagueSlate.jsx`

---

### Task 1: Extract slate-date utilities

**Files:**
- Create: `frontend/src/utils/slateDate.js`
- Test:   `frontend/src/__tests__/utilities/slateDate.test.js`

These four helpers currently live as inner functions inside `LeagueSlate.jsx`. Extracting them lets multiple consumers (`useSlateGames`, `useGlobalSlate`, `GlobalSlate`) share them and lets us unit-test them directly. Also adds a new `resolveLeagueFilter(pathname)` helper used by `App.jsx`.

- [ ] **Step 1: Write failing tests**

Create `frontend/src/__tests__/utilities/slateDate.test.js`:

```javascript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getSlateDateET,
  parseStartTime,
  compactTime,
  statusGroup,
  resolveLeagueFilter,
} from "../../utils/slateDate.js";

describe("getSlateDateET", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns today's ET date when current ET hour >= 6", () => {
    // 2026-05-02 12:00 UTC = 2026-05-02 08:00 ET (after 6 AM cutover)
    vi.setSystemTime(new Date("2026-05-02T12:00:00Z"));
    expect(getSlateDateET()).toBe("2026-05-02");
  });

  it("rolls back to yesterday's ET date when current ET hour < 6", () => {
    // 2026-05-02 07:00 UTC = 2026-05-02 03:00 ET (before 6 AM cutover)
    vi.setSystemTime(new Date("2026-05-02T07:00:00Z"));
    expect(getSlateDateET()).toBe("2026-05-01");
  });
});

describe("parseStartTime", () => {
  it("parses '7:30PM ET' to 19*60 + 30", () => {
    expect(parseStartTime("7:30PM ET")).toBe(19 * 60 + 30);
  });

  it("parses '7PM ET' (no minutes) to 19*60", () => {
    expect(parseStartTime("7PM ET")).toBe(19 * 60);
  });

  it("parses '12AM ET' as midnight (0)", () => {
    expect(parseStartTime("12AM ET")).toBe(0);
  });

  it("parses '12PM ET' as noon (12*60)", () => {
    expect(parseStartTime("12PM ET")).toBe(12 * 60);
  });

  it("returns 9999 for null/empty/garbage", () => {
    expect(parseStartTime(null)).toBe(9999);
    expect(parseStartTime("")).toBe(9999);
    expect(parseStartTime("TBD")).toBe(9999);
  });
});

describe("compactTime", () => {
  it("strips ' ET' and shortens 'PM'/'AM' to single letter", () => {
    expect(compactTime("7:30PM ET")).toBe("7:30P");
    expect(compactTime("11AM ET")).toBe("11A");
  });
  it("returns 'TBD' for null/empty", () => {
    expect(compactTime(null)).toBe("TBD");
    expect(compactTime("")).toBe("TBD");
  });
});

describe("statusGroup", () => {
  it("returns 'final' for Final statuses", () => {
    expect(statusGroup({ status: "Final" })).toBe("final");
    expect(statusGroup({ status: "Final/OT" })).toBe("final");
  });
  it("returns 'live' for In Progress / Halftime / End of Period", () => {
    expect(statusGroup({ status: "In Progress" })).toBe("live");
    expect(statusGroup({ status: "Halftime" })).toBe("live");
    expect(statusGroup({ status: "End of Period" })).toBe("live");
  });
  it("returns 'scheduled' otherwise", () => {
    expect(statusGroup({ status: "Scheduled" })).toBe("scheduled");
    expect(statusGroup({ status: undefined })).toBe("scheduled");
    expect(statusGroup({})).toBe("scheduled");
  });
});

describe("resolveLeagueFilter", () => {
  it("returns the league when first segment is nba/nfl/nhl", () => {
    expect(resolveLeagueFilter("/nba")).toBe("nba");
    expect(resolveLeagueFilter("/nfl/games/123")).toBe("nfl");
    expect(resolveLeagueFilter("/nhl/players/abc")).toBe("nhl");
  });
  it("returns null for the root path and non-league routes", () => {
    expect(resolveLeagueFilter("/")).toBe(null);
    expect(resolveLeagueFilter("/reports")).toBe(null);
    expect(resolveLeagueFilter("/settings")).toBe(null);
    expect(resolveLeagueFilter("/compare")).toBe(null);
    expect(resolveLeagueFilter("/about")).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/utilities/slateDate.test.js`
Expected: FAIL — "Failed to resolve import" / module not found.

- [ ] **Step 3: Create the util module**

Create `frontend/src/utils/slateDate.js`:

```javascript
// Status group keys: "live" | "final" | "scheduled"
export function statusGroup(game) {
  const s = game?.status || "";
  if (s.includes("Final")) return "final";
  if (
    s.includes("In Progress") ||
    s.includes("Halftime") ||
    s.includes("End of Period")
  ) {
    return "live";
  }
  return "scheduled";
}

// Today's ET date, rolling back to yesterday before 6 AM ET so late-night
// viewers still see last night's finals (matches the existing LeagueSlate
// behavior — without it the rail goes empty between midnight and 6 AM).
export function getSlateDateET() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const h = parseInt(get("hour"), 10);
  if (h >= 6) return `${y}-${m}-${d}`;
  const prev = new Date(`${y}-${m}-${d}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const yy = prev.getUTCFullYear();
  const mm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(prev.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// "7:30PM ET" / "7PM ET" → minutes since midnight (for chronological sort).
// Returns 9999 for unparseable input so those pills sort to the end.
export function parseStartTime(s) {
  if (!s) return 9999;
  const m = s.match(/(\d+)(?::(\d+))?\s*(AM|PM)/i);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const pm = m[3].toUpperCase() === "PM";
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return h * 60 + min;
}

// "7:30PM ET" → "7:30P"
export function compactTime(s) {
  if (!s) return "TBD";
  return s.replace(/\s*ET\s*$/i, "").replace(/([AP])M/i, "$1");
}

// First path segment → "nba" | "nfl" | "nhl" | null
const LEAGUE_SLUGS = new Set(["nba", "nfl", "nhl"]);
export function resolveLeagueFilter(pathname) {
  const seg = (pathname || "").split("/")[1] || "";
  return LEAGUE_SLUGS.has(seg) ? seg : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/utilities/slateDate.test.js`
Expected: PASS — all 13 assertions pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/slateDate.js frontend/src/__tests__/utilities/slateDate.test.js
git commit -m "feat(slate): extract slate-date utilities into shared module"
```

---

### Task 2: Add `useSlateGames` hook

**Files:**
- Create: `frontend/src/hooks/data/useSlateGames.js`
- Test:   `frontend/src/__tests__/hooks/useSlateGames.test.js`

Single-league hook: fetches today's slate via the existing `leagueGames` cache key (so it shares cache with `useLeagueData`), normalizes the `{games, resolvedDate}` envelope, opens an SSE connection when there are live games, and pushes SSE updates back into the cache. Mirror of the games-only portion of `useLeagueData` plus the `useHomeGames` SSE pattern.

- [ ] **Step 1: Write failing tests**

Create `frontend/src/__tests__/hooks/useSlateGames.test.js`:

```javascript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/games.js", () => ({ getLeagueGames: vi.fn() }));
vi.mock("../../hooks/live/useLiveGames.js", () => ({ useLiveGames: vi.fn() }));
vi.mock("../../utils/slateDate.js", async () => {
  const actual = await vi.importActual("../../utils/slateDate.js");
  return { ...actual, getSlateDateET: vi.fn(() => "2026-05-02") };
});

const { getLeagueGames } = await import("../../api/games.js");
const { useLiveGames } = await import("../../hooks/live/useLiveGames.js");
const { useSlateGames } = await import("../../hooks/data/useSlateGames.js");

beforeEach(() => {
  vi.clearAllMocks();
  useLiveGames.mockReturnValue({ liveGames: null });
});

describe("useSlateGames", () => {
  it("returns games + resolvedDate when backend returns the date envelope", async () => {
    getLeagueGames.mockResolvedValue({
      games: [{ id: 1, status: "Final" }],
      resolvedDate: "2026-05-02",
      resolvedSeason: "2025-26",
    });

    const { result } = renderHook(() => useSlateGames("nba"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.games).toEqual([{ id: 1, status: "Final" }]);
    expect(result.current.resolvedDate).toBe("2026-05-02");
    expect(result.current.error).toBe(false);
  });

  it("calls getLeagueGames with the slate date", async () => {
    getLeagueGames.mockResolvedValue({ games: [], resolvedDate: "2026-05-02" });

    renderHook(() => useSlateGames("nba"), { wrapper: createWrapper() });

    await waitFor(() => expect(getLeagueGames).toHaveBeenCalled());
    const callArgs = getLeagueGames.mock.calls[0];
    expect(callArgs[0]).toBe("nba");
    expect(callArgs[1].date).toBe("2026-05-02");
  });

  it("does not fire the query when enabled=false", async () => {
    getLeagueGames.mockResolvedValue({ games: [], resolvedDate: "2026-05-02" });

    renderHook(() => useSlateGames("nfl", { enabled: false }), {
      wrapper: createWrapper(),
    });

    // Wait a tick to let TQ settle
    await new Promise((r) => setTimeout(r, 10));
    expect(getLeagueGames).not.toHaveBeenCalled();
  });

  it("returns error=true when the query errors", async () => {
    getLeagueGames.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useSlateGames("nba"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.games).toEqual([]);
  });

  it("subscribes to SSE only when there is a live game", async () => {
    getLeagueGames.mockResolvedValue({
      games: [{ id: 1, status: "In Progress" }],
      resolvedDate: "2026-05-02",
    });

    const { result } = renderHook(() => useSlateGames("nba"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Last call to useLiveGames should be with the league name once games arrive
    const lastCall = useLiveGames.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("nba");
  });

  it("does NOT subscribe to SSE when no games are live", async () => {
    getLeagueGames.mockResolvedValue({
      games: [{ id: 1, status: "Scheduled" }],
      resolvedDate: "2026-05-02",
    });

    renderHook(() => useSlateGames("nba"), { wrapper: createWrapper() });

    await waitFor(() => expect(getLeagueGames).toHaveBeenCalled());
    // After data resolves, useLiveGames should be called with null
    const lastCall = useLiveGames.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/hooks/useSlateGames.test.js`
Expected: FAIL — "Failed to resolve import './useSlateGames.js'".

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/data/useSlateGames.js`:

```javascript
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLeagueGames } from "../../api/games.js";
import { useLiveGames } from "../live/useLiveGames.js";
import { queryKeys } from "../../lib/query.js";
import { getSlateDateET, statusGroup } from "../../utils/slateDate.js";

function hasLiveGame(games) {
  return games.some((g) => statusGroup(g) === "live");
}

export function useSlateGames(league, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const slateDate = getSlateDateET();

  const query = useQuery({
    queryKey: queryKeys.leagueGames(league, null, slateDate),
    queryFn: ({ signal }) =>
      getLeagueGames(league, { date: slateDate, signal }),
    enabled,
    staleTime: 0,
  });

  // Backend returns either { games, resolvedDate, resolvedSeason } (when a
  // date is passed) or a plain array. Normalize.
  const raw = query.data;
  let games = [];
  let resolvedDate = null;
  if (raw && !Array.isArray(raw)) {
    games = raw.games ?? [];
    resolvedDate = raw.resolvedDate ?? null;
  } else if (Array.isArray(raw)) {
    games = raw;
  }

  // SSE subscription gated on live games to avoid idle EventSources.
  const sseLeague = enabled && hasLiveGame(games) ? league : null;
  const { liveGames } = useLiveGames(sseLeague);

  // Fold SSE updates back into the same cache key the query uses, so the rail
  // updates without refetching. Mirrors useLeagueData's pump.
  useEffect(() => {
    if (!liveGames || !sseLeague) return;
    const payload = liveGames.filter((g) => {
      const d = typeof g.date === "string" ? g.date.slice(0, 10) : "";
      return d === slateDate;
    });
    queryClient.setQueryData(
      queryKeys.leagueGames(league, null, slateDate),
      { games: payload, resolvedDate, resolvedSeason: null }
    );
  }, [liveGames, sseLeague, queryClient, league, slateDate, resolvedDate]);

  return {
    games,
    resolvedDate,
    loading: query.isLoading,
    error: query.isError,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/hooks/useSlateGames.test.js`
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/data/useSlateGames.js frontend/src/__tests__/hooks/useSlateGames.test.js
git commit -m "feat(slate): add useSlateGames single-league fetcher with SSE pump"
```

---

### Task 3: Add `useGlobalSlate` hook

**Files:**
- Create: `frontend/src/hooks/data/useGlobalSlate.js`
- Test:   `frontend/src/__tests__/hooks/useGlobalSlate.test.js`

Orchestrator that fans out to up to three `useSlateGames` calls. Always invokes the hook for all three leagues (React Hooks rules) but disables the irrelevant ones via `enabled`. Per-league off-season is detected via `resolvedDate !== slateDate` and that league is silently dropped. Returns merged + sorted games (live → upcoming → final), each tagged with `{ league }`.

- [ ] **Step 1: Write failing tests**

Create `frontend/src/__tests__/hooks/useGlobalSlate.test.js`:

```javascript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../hooks/data/useSlateGames.js", () => ({ useSlateGames: vi.fn() }));
vi.mock("../../utils/slateDate.js", async () => {
  const actual = await vi.importActual("../../utils/slateDate.js");
  return { ...actual, getSlateDateET: vi.fn(() => "2026-05-02") };
});

const { useSlateGames } = await import("../../hooks/data/useSlateGames.js");
const { useGlobalSlate } = await import("../../hooks/data/useGlobalSlate.js");

function mockLeagueResponse(perLeague) {
  // perLeague: { nba: {games, resolvedDate, loading, error}, nfl: ..., nhl: ... }
  useSlateGames.mockImplementation((league, opts = {}) => {
    if (opts.enabled === false) {
      return { games: [], resolvedDate: null, loading: false, error: false };
    }
    return perLeague[league] ?? { games: [], resolvedDate: null, loading: false, error: false };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useGlobalSlate — single-league filter", () => {
  it("returns only the filtered league's games", async () => {
    mockLeagueResponse({
      nba: {
        games: [{ id: 1, status: "Final", start_time: "7PM ET" }],
        resolvedDate: "2026-05-02",
        loading: false,
        error: false,
      },
      // nfl/nhl should be disabled — return empty stubs from default branch
    });

    const { result } = renderHook(() => useGlobalSlate("nba"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.games).toEqual([
      { id: 1, status: "Final", start_time: "7PM ET", league: "nba" },
    ]);
  });

  it("disables non-filtered leagues", () => {
    mockLeagueResponse({
      nba: { games: [], resolvedDate: "2026-05-02", loading: false, error: false },
    });
    renderHook(() => useGlobalSlate("nba"), { wrapper: createWrapper() });

    const calls = useSlateGames.mock.calls;
    const nbaCall = calls.find((c) => c[0] === "nba");
    const nflCall = calls.find((c) => c[0] === "nfl");
    const nhlCall = calls.find((c) => c[0] === "nhl");
    expect(nbaCall[1]?.enabled).not.toBe(false); // enabled (or undefined)
    expect(nflCall[1]?.enabled).toBe(false);
    expect(nhlCall[1]?.enabled).toBe(false);
  });
});

describe("useGlobalSlate — multi-league filter (null)", () => {
  it("merges games from all three leagues with league tags", async () => {
    mockLeagueResponse({
      nba: {
        games: [{ id: 1, status: "Final", start_time: "7PM ET" }],
        resolvedDate: "2026-05-02",
        loading: false,
        error: false,
      },
      nfl: {
        games: [{ id: 2, status: "In Progress", start_time: "1PM ET" }],
        resolvedDate: "2026-05-02",
        loading: false,
        error: false,
      },
      nhl: {
        games: [{ id: 3, status: "Scheduled", start_time: "8PM ET" }],
        resolvedDate: "2026-05-02",
        loading: false,
        error: false,
      },
    });

    const { result } = renderHook(() => useGlobalSlate(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Order: live (NFL) → scheduled (NHL) → final (NBA)
    expect(result.current.games.map((g) => g.id)).toEqual([2, 3, 1]);
    expect(result.current.games.map((g) => g.league)).toEqual(["nfl", "nhl", "nba"]);
  });

  it("drops a league silently when its resolvedDate differs (off-season)", async () => {
    mockLeagueResponse({
      nba: {
        games: [{ id: 1, status: "Final", start_time: "7PM ET" }],
        resolvedDate: "2026-05-02",
        loading: false,
        error: false,
      },
      nfl: {
        // Off-season — backend redirected to a past date
        games: [{ id: 99, status: "Final" }],
        resolvedDate: "2026-01-15",
        loading: false,
        error: false,
      },
      nhl: {
        games: [],
        resolvedDate: "2026-05-02",
        loading: false,
        error: false,
      },
    });

    const { result } = renderHook(() => useGlobalSlate(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.games.map((g) => g.id)).toEqual([1]);
    expect(result.current.games.map((g) => g.league)).toEqual(["nba"]);
  });

  it("does not mark loading=true once any league has resolved", () => {
    mockLeagueResponse({
      nba: {
        games: [{ id: 1, status: "Final", start_time: "7PM ET" }],
        resolvedDate: "2026-05-02",
        loading: false,
        error: false,
      },
      nfl: { games: [], resolvedDate: null, loading: true, error: false },
      nhl: { games: [], resolvedDate: null, loading: true, error: false },
    });

    const { result } = renderHook(() => useGlobalSlate(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.games.map((g) => g.id)).toEqual([1]);
  });

  it("loading=true only while all leagues are still loading", () => {
    mockLeagueResponse({
      nba: { games: [], resolvedDate: null, loading: true, error: false },
      nfl: { games: [], resolvedDate: null, loading: true, error: false },
      nhl: { games: [], resolvedDate: null, loading: true, error: false },
    });

    const { result } = renderHook(() => useGlobalSlate(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
  });

  it("error=true only when all leagues errored", () => {
    mockLeagueResponse({
      nba: { games: [], resolvedDate: null, loading: false, error: true },
      nfl: { games: [], resolvedDate: null, loading: false, error: true },
      nhl: { games: [], resolvedDate: null, loading: false, error: true },
    });

    const { result } = renderHook(() => useGlobalSlate(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.error).toBe(true);
  });

  it("error=false if at least one league succeeded", () => {
    mockLeagueResponse({
      nba: {
        games: [{ id: 1, status: "Final", start_time: "7PM ET" }],
        resolvedDate: "2026-05-02",
        loading: false,
        error: false,
      },
      nfl: { games: [], resolvedDate: null, loading: false, error: true },
      nhl: { games: [], resolvedDate: null, loading: false, error: true },
    });

    const { result } = renderHook(() => useGlobalSlate(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.error).toBe(false);
    expect(result.current.games.map((g) => g.id)).toEqual([1]);
  });
});

describe("useGlobalSlate — sort within group", () => {
  it("sorts scheduled games chronologically by start_time", async () => {
    mockLeagueResponse({
      nba: {
        games: [
          { id: "late", status: "Scheduled", start_time: "10PM ET" },
          { id: "early", status: "Scheduled", start_time: "7PM ET" },
        ],
        resolvedDate: "2026-05-02",
        loading: false,
        error: false,
      },
    });

    const { result } = renderHook(() => useGlobalSlate("nba"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.games.map((g) => g.id)).toEqual(["early", "late"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/hooks/useGlobalSlate.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/data/useGlobalSlate.js`:

```javascript
import { useMemo } from "react";
import { useSlateGames } from "./useSlateGames.js";
import {
  getSlateDateET,
  parseStartTime,
  statusGroup,
} from "../../utils/slateDate.js";

const ALL_LEAGUES = ["nba", "nfl", "nhl"];

function isInScope(league, leagueFilter) {
  return leagueFilter === null || leagueFilter === league;
}

function shouldDropLeague(slateDate, source) {
  // Off-season signal: backend redirects to an earlier resolvedDate when
  // today has no games. Drop that league's contribution silently.
  return source.resolvedDate !== null && source.resolvedDate !== slateDate;
}

function sortBySlateOrder(games) {
  // live → scheduled (chrono) → final
  const live = [];
  const scheduled = [];
  const final = [];
  for (const g of games) {
    const grp = statusGroup(g);
    if (grp === "live") live.push(g);
    else if (grp === "final") final.push(g);
    else scheduled.push(g);
  }
  scheduled.sort(
    (a, b) => parseStartTime(a.start_time) - parseStartTime(b.start_time)
  );
  return [...live, ...scheduled, ...final];
}

export function useGlobalSlate(leagueFilter) {
  const slateDate = getSlateDateET();

  // Always call the hook for every league (Hooks rules), gate via `enabled`.
  const nba = useSlateGames("nba", { enabled: isInScope("nba", leagueFilter) });
  const nfl = useSlateGames("nfl", { enabled: isInScope("nfl", leagueFilter) });
  const nhl = useSlateGames("nhl", { enabled: isInScope("nhl", leagueFilter) });

  const sources = [
    { league: "nba", ...nba },
    { league: "nfl", ...nfl },
    { league: "nhl", ...nhl },
  ].filter((s) => isInScope(s.league, leagueFilter));

  const games = useMemo(() => {
    const merged = [];
    for (const src of sources) {
      if (shouldDropLeague(slateDate, src)) continue;
      for (const g of src.games) merged.push({ ...g, league: src.league });
    }
    return sortBySlateOrder(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slateDate,
    nba.games,
    nba.resolvedDate,
    nfl.games,
    nfl.resolvedDate,
    nhl.games,
    nhl.resolvedDate,
    leagueFilter,
  ]);

  // loading: all in-scope sources still loading
  const loading = sources.every((s) => s.loading);
  // error: every in-scope source errored (per-league errors silently drop)
  const error = sources.length > 0 && sources.every((s) => s.error);

  return { games, loading, error };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/hooks/useGlobalSlate.test.js`
Expected: PASS — all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/data/useGlobalSlate.js frontend/src/__tests__/hooks/useGlobalSlate.test.js
git commit -m "feat(slate): add useGlobalSlate multi-league orchestrator"
```

---

### Task 4: Rename `LeagueSlateSkeleton` → `GlobalSlateSkeleton`

**Files:**
- Modify: `frontend/src/components/skeletons/LeaguePageSkeleton.jsx`
- Modify: `frontend/src/components/navigation/LeagueSlate.jsx` (update import name; this file is deleted in Task 7)

The skeleton lives in `LeaguePageSkeleton.jsx` and is currently named `LeagueSlateSkeleton`. Rename the export to match the new component name and add a `data-testid` so the upcoming `GlobalSlate` component test can detect the skeleton. Update the one consumer (`LeagueSlate.jsx`) so the build keeps working until Task 7 deletes that file.

- [ ] **Step 1: Rename the export and add data-testid**

Edit `frontend/src/components/skeletons/LeaguePageSkeleton.jsx`. Find the `LeagueSlateSkeleton` function (around line 26):

```jsx
export function LeagueSlateSkeleton() {
  return (
    <div className="mb-5 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-2 pb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <GamePillSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
```

Replace with:

```jsx
export function GlobalSlateSkeleton() {
  return (
    <div
      data-testid="global-slate-skeleton"
      className="border-b border-white/[0.06] overflow-x-auto scrollbar-none"
    >
      <div className="flex items-center gap-2 px-5 py-2 max-w-[1200px] mx-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <GamePillSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the one remaining consumer**

Edit `frontend/src/components/navigation/LeagueSlate.jsx` line 4:

```javascript
import { LeagueSlateSkeleton } from "../skeletons/LeaguePageSkeleton.jsx";
```

Replace with:

```javascript
import { GlobalSlateSkeleton } from "../skeletons/LeaguePageSkeleton.jsx";
```

And find the usage (around line 202):

```javascript
if (loading) return <LeagueSlateSkeleton />;
```

Replace with:

```javascript
if (loading) return <GlobalSlateSkeleton />;
```

- [ ] **Step 3: Verify nothing else references the old name**

Run: `cd frontend && grep -rn "LeagueSlateSkeleton" src/`
Expected: no matches.

- [ ] **Step 4: Run the existing test suite to confirm nothing broke**

Run: `cd frontend && npm test`
Expected: PASS (no test references `LeagueSlateSkeleton` directly today).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/skeletons/LeaguePageSkeleton.jsx frontend/src/components/navigation/LeagueSlate.jsx
git commit -m "refactor(skeletons): rename LeagueSlateSkeleton to GlobalSlateSkeleton"
```

---

### Task 5: Create `GlobalSlate` component (replaces `LeagueSlate`)

**Files:**
- Create: `frontend/src/components/layout/GlobalSlate.jsx`
- Test:   `frontend/src/__tests__/components/GlobalSlate.test.jsx`

This task **creates** the new component alongside the old one. The old `LeagueSlate.jsx` stays in place until Task 7 unwires its caller; deleting it now would break `LeaguePage` mid-plan.

`GlobalSlate` accepts `leagueFilter: "nba" | "nfl" | "nhl" | null`, calls `useGlobalSlate`, and renders a horizontal pill rail. New behavior over `LeagueSlate`:

- Reads `useLocation().pathname` and returns `null` on `/about` and `/privacy`
- When `leagueFilter === null`, prepends a small uppercase league tag to each pill (`NBA` / `NFL` / `NHL`); when set, omits the tag
- Adds `onMouseEnter` prefetch for `gameDetail` query on each pill (matches codebase convention)
- Sticky on desktop (`sm:` and up), static on mobile

- [ ] **Step 1: Write failing tests**

Create `frontend/src/__tests__/components/GlobalSlate.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../hooks/data/useGlobalSlate.js", () => ({ useGlobalSlate: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

const { useGlobalSlate } = await import("../../hooks/data/useGlobalSlate.js");
const GlobalSlate = (await import("../../components/layout/GlobalSlate.jsx")).default;

function renderAt(path, props = { leagueFilter: null }) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GlobalSlate {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GlobalSlate", () => {
  it("renders nothing when games is empty and not loading", () => {
    useGlobalSlate.mockReturnValue({ games: [], loading: false, error: false });
    const { container } = renderAt("/");
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when error and games empty", () => {
    useGlobalSlate.mockReturnValue({ games: [], loading: false, error: true });
    const { container } = renderAt("/");
    expect(container.firstChild).toBeNull();
  });

  it("renders skeleton while loading", () => {
    useGlobalSlate.mockReturnValue({ games: [], loading: true, error: false });
    renderAt("/");
    expect(screen.getByTestId("global-slate-skeleton")).toBeInTheDocument();
  });

  it("renders pills for each game", () => {
    useGlobalSlate.mockReturnValue({
      games: [
        {
          id: 1,
          league: "nba",
          status: "Final",
          start_time: "7PM ET",
          home_shortname: "Lakers",
          away_shortname: "Celtics",
          home_logo: null,
          away_logo: null,
          homescore: 102,
          awayscore: 99,
          hometeamid: 1,
          awayteamid: 2,
          winnerid: 1,
        },
      ],
      loading: false,
      error: false,
    });
    renderAt("/");
    expect(screen.getByText("Lakers")).toBeInTheDocument();
    expect(screen.getByText("Celtics")).toBeInTheDocument();
    expect(screen.getByText("FINAL")).toBeInTheDocument();
  });

  it("shows league tag in multi-league mode (leagueFilter=null)", () => {
    useGlobalSlate.mockReturnValue({
      games: [
        {
          id: 1,
          league: "nba",
          status: "In Progress",
          home_shortname: "Lakers",
          away_shortname: "Celtics",
          home_logo: null,
          away_logo: null,
          homescore: 50,
          awayscore: 48,
          hometeamid: 1,
          awayteamid: 2,
          winnerid: null,
        },
      ],
      loading: false,
      error: false,
    });
    renderAt("/", { leagueFilter: null });
    expect(screen.getByText("NBA")).toBeInTheDocument();
  });

  it("hides league tag when leagueFilter is set", () => {
    useGlobalSlate.mockReturnValue({
      games: [
        {
          id: 1,
          league: "nba",
          status: "In Progress",
          home_shortname: "Lakers",
          away_shortname: "Celtics",
          home_logo: null,
          away_logo: null,
          homescore: 50,
          awayscore: 48,
          hometeamid: 1,
          awayteamid: 2,
          winnerid: null,
        },
      ],
      loading: false,
      error: false,
    });
    renderAt("/nba", { leagueFilter: "nba" });
    expect(screen.queryByText("NBA")).not.toBeInTheDocument();
  });

  it("hides on /about", () => {
    useGlobalSlate.mockReturnValue({
      games: [{ id: 1, league: "nba", status: "Final", home_shortname: "X", away_shortname: "Y" }],
      loading: false,
      error: false,
    });
    const { container } = renderAt("/about");
    expect(container.firstChild).toBeNull();
  });

  it("hides on /privacy", () => {
    useGlobalSlate.mockReturnValue({
      games: [{ id: 1, league: "nba", status: "Final", home_shortname: "X", away_shortname: "Y" }],
      loading: false,
      error: false,
    });
    const { container } = renderAt("/privacy");
    expect(container.firstChild).toBeNull();
  });

  it("links each pill to /{league}/games/{id}", () => {
    useGlobalSlate.mockReturnValue({
      games: [
        {
          id: 42,
          league: "nfl",
          status: "Scheduled",
          start_time: "1PM ET",
          home_shortname: "Bills",
          away_shortname: "Chiefs",
          home_logo: null,
          away_logo: null,
          hometeamid: 1,
          awayteamid: 2,
          winnerid: null,
        },
      ],
      loading: false,
      error: false,
    });
    renderAt("/");
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/nfl/games/42");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/__tests__/components/GlobalSlate.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/layout/GlobalSlate.jsx`:

```jsx
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useGlobalSlate } from "../../hooks/data/useGlobalSlate.js";
import { GlobalSlateSkeleton } from "../skeletons/LeaguePageSkeleton.jsx";
import { compactTime, statusGroup } from "../../utils/slateDate.js";
import { queryKeys, queryFns } from "../../lib/query.js";

const HIDDEN_PATHS = new Set(["/about", "/privacy"]);

function TeamSide({ name, logo, score, showScore, isWinner, isLoser, isLive }) {
  const nameClass = isWinner
    ? "text-text-primary font-semibold"
    : isLoser
    ? "text-text-tertiary"
    : isLive
    ? "text-text-primary"
    : "text-text-secondary";

  const scoreClass = isWinner
    ? "text-text-primary font-semibold"
    : isLoser
    ? "text-text-tertiary"
    : "text-text-primary font-semibold";

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {logo ? (
        <img
          loading="lazy"
          src={logo}
          alt=""
          className="w-4 h-4 object-contain flex-shrink-0"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = "none";
          }}
        />
      ) : null}
      <span className={`text-[13px] whitespace-nowrap ${nameClass}`}>
        {name}
      </span>
      {showScore && (
        <span className={`text-[13px] tabular-nums ${scoreClass}`}>
          {score}
        </span>
      )}
    </div>
  );
}

function GamePill({ game, showLeagueTag, queryClient }) {
  const group = statusGroup(game);
  const isLive = group === "live";
  const isFinal = group === "final";
  const showScore = isLive || isFinal;

  const homePh = game.home_shortname?.includes("/");
  const awayPh = game.away_shortname?.includes("/");
  const homeName = homePh ? "TBD" : game.home_shortname;
  const awayName = awayPh ? "TBD" : game.away_shortname;
  const homeLogo = homePh ? null : game.home_logo;
  const awayLogo = awayPh ? null : game.away_logo;

  const homeWon = isFinal && game.hometeamid === game.winnerid;
  const awayWon = isFinal && game.awayteamid === game.winnerid;

  const label = isLive
    ? "Live"
    : isFinal
    ? "Final"
    : compactTime(game.start_time);
  const labelColor = isLive ? "text-live" : "text-text-tertiary";

  return (
    <Link
      to={`/${game.league}/games/${game.id}`}
      onMouseEnter={() => {
        if (window.matchMedia("(hover: hover)").matches) {
          queryClient.prefetchQuery({
            queryKey: queryKeys.game(game.league, game.id),
            queryFn: queryFns.game(game.league, game.id),
            staleTime: 10_000,
          });
        }
      }}
      className="flex-1 min-w-fit inline-flex items-center justify-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-xl px-3 py-2 transition-colors duration-150"
    >
      {showLeagueTag && (
        <span className="text-[9px] font-semibold uppercase tracking-widest text-text-tertiary">
          {game.league.toUpperCase()}
        </span>
      )}
      <div className="flex items-center gap-1.5 pr-3 border-r border-white/[0.08]">
        {isLive && (
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-live opacity-75 animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-live" />
          </span>
        )}
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest tabular-nums ${labelColor}`}
        >
          {label}
        </span>
      </div>

      <TeamSide
        name={awayName}
        logo={awayLogo}
        score={game.awayscore}
        showScore={showScore}
        isWinner={awayWon}
        isLoser={homeWon}
        isLive={isLive}
      />
      <span className="text-text-tertiary text-xs">·</span>
      <TeamSide
        name={homeName}
        logo={homeLogo}
        score={game.homescore}
        showScore={showScore}
        isWinner={homeWon}
        isLoser={awayWon}
        isLive={isLive}
      />
    </Link>
  );
}

export default function GlobalSlate({ leagueFilter = null }) {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const { games, loading, error } = useGlobalSlate(leagueFilter);

  if (HIDDEN_PATHS.has(pathname)) return null;
  if (loading) return <GlobalSlateSkeleton />;
  if (error || games.length === 0) return null;

  const showLeagueTag = leagueFilter === null;

  return (
    <div className="sm:sticky sm:top-14 z-40 bg-[#0a0a0c] sm:bg-[rgba(10,10,12,0.88)] sm:backdrop-blur-2xl border-b border-white/[0.06] overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-2 px-5 py-2 max-w-[1200px] mx-auto">
        {games.map((g) => (
          <GamePill
            key={`${g.league}-${g.id}`}
            game={g}
            showLeagueTag={showLeagueTag}
            queryClient={queryClient}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/__tests__/components/GlobalSlate.test.jsx`
Expected: PASS — all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/GlobalSlate.jsx frontend/src/__tests__/components/GlobalSlate.test.jsx
git commit -m "feat(slate): add GlobalSlate layout component"
```

---

### Task 6: Mount `GlobalSlate` in `App.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`

Mount the global rail inside `AppShellInner`, just below `<Navbar />` and above the routed outlet. Resolve `leagueFilter` from the current URL via `useLocation()` + `resolveLeagueFilter`. The `AppShellInner` is wrapped by everything that mounts on `*` (i.e. all routes except `/auth/callback`), so the rail is automatically present everywhere except the auth callback page — exactly what we want.

- [ ] **Step 1: Open `frontend/src/App.jsx`**

The current top-of-file imports include (line 8-9):

```javascript
import Navbar from "./components/layout/Navbar.jsx";
import Footer from "./components/layout/Footer.jsx";
```

Add a new import alongside them:

```javascript
import Navbar from "./components/layout/Navbar.jsx";
import GlobalSlate from "./components/layout/GlobalSlate.jsx";
import Footer from "./components/layout/Footer.jsx";
```

And import `resolveLeagueFilter` near the other utility imports. After the existing `import { trackVisit } from "./lib/pwaVisitTracking.js";` (line 20), add:

```javascript
import { resolveLeagueFilter } from "./utils/slateDate.js";
```

- [ ] **Step 2: Mount the rail in `AppShellInner`**

Find the `AppShellInner` component (line 66):

```jsx
function AppShellInner() {
  useEffect(() => {
    trackVisit();
  }, []);
  useBlockEdgeSwipe();

  return (
    <div className="bg-surface-primary text-text-primary min-h-screen font-sans antialiased">
      <Navbar />
      <ScrollToTop />
      <ErrorBoundary>
        <AnimatedRoutes />
      </ErrorBoundary>
      <Footer />
      <IOSInstallHint />
    </div>
  );
}
```

Replace with:

```jsx
function AppShellInner() {
  const { pathname } = useLocation();
  const leagueFilter = resolveLeagueFilter(pathname);

  useEffect(() => {
    trackVisit();
  }, []);
  useBlockEdgeSwipe();

  return (
    <div className="bg-surface-primary text-text-primary min-h-screen font-sans antialiased">
      <Navbar />
      <GlobalSlate leagueFilter={leagueFilter} />
      <ScrollToTop />
      <ErrorBoundary>
        <AnimatedRoutes />
      </ErrorBoundary>
      <Footer />
      <IOSInstallHint />
    </div>
  );
}
```

`useLocation` is already imported at the top of `App.jsx` (line 2). No new react-router import needed.

- [ ] **Step 3: Verify the existing Navbar tests still pass**

Run: `cd frontend && npx vitest run src/__tests__/components/Navbar.test.jsx`
Expected: PASS — Navbar tests don't render `GlobalSlate` directly so they're unaffected.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(slate): mount GlobalSlate in app shell with URL-driven league filter"
```

---

### Task 7: Remove inline `LeagueSlate` from `LeaguePage` and delete the old component

**Files:**
- Modify: `frontend/src/pages/LeaguePage.jsx`
- Delete: `frontend/src/components/navigation/LeagueSlate.jsx`

The global rail now covers what the inline `LeagueSlate` did. Strip the import, the `showSlate` derived value, and the render. Then delete the old component file — nothing should reference it now.

- [ ] **Step 1: Confirm no remaining consumers**

Run: `cd frontend && grep -rn "LeagueSlate" src/ --include="*.jsx" --include="*.js"`
Expected output:
- `src/pages/LeaguePage.jsx` (the import + showSlate + render lines we are about to remove)
- `src/components/navigation/LeagueSlate.jsx` (the file we are about to delete)

If anything else matches, stop and update it before continuing.

- [ ] **Step 2: Edit `LeaguePage.jsx`**

Remove three things:

(a) Line 21 — the import:

```javascript
import LeagueSlate from "../components/navigation/LeagueSlate.jsx";
```
Delete this line entirely.

(b) Line 160 — the `showSlate` derivation:

```javascript
const showSlate = activeTab === "games" && !selectedSeason;
```
Delete this line entirely.

(c) Line 414 — the render:

```jsx
{showSlate && <LeagueSlate league={league} />}
```
Delete this line entirely.

- [ ] **Step 3: Delete the old component file**

Run: `git rm frontend/src/components/navigation/LeagueSlate.jsx`

- [ ] **Step 4: Confirm cleanup is complete**

Run: `cd frontend && grep -rn "LeagueSlate" src/`
Expected: no matches.

Run: `cd frontend && grep -rn "showSlate" src/`
Expected: no matches.

- [ ] **Step 5: Run the full frontend lint + test suite**

Run: `cd frontend && npm run lint`
Expected: PASS (no errors).

Run: `cd frontend && npm test`
Expected: PASS — all suites green. New tests (slateDate, useSlateGames, useGlobalSlate, GlobalSlate) included in the run.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/LeaguePage.jsx frontend/src/components/navigation/LeagueSlate.jsx
git commit -m "refactor(LeaguePage): remove inline LeagueSlate (covered by global rail)"
```

---

### Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds with no warnings about missing modules or unused exports.

- [ ] **Step 2: Run frontend verify (lint + test + build, what CI runs)**

Run: `cd frontend && npm run verify`
Expected: PASS.

- [ ] **Step 3: Manual browser smoke test**

Run: `cd frontend && npm run dev`

In a browser (the user verifies — agentic worker should report the steps and stop):

- Visit `/` — rail shows games from all three leagues with `NBA`/`NFL`/`NHL` tags. Rail is at the top of page content, NOT sticky on mobile (resize to ≤640 px to confirm), sticky on desktop.
- Visit `/nba` — rail shows only NBA games, no league tags. The old standalone slate above the date navigation is gone (it's now the rail).
- Visit `/nba/games/{some-id}` — rail still shows NBA-only games.
- Visit `/reports` — rail shows mixed leagues with tags.
- Visit `/about` — rail is hidden.
- Visit `/privacy` — rail is hidden.
- Click a pill — navigates to the game detail page.
- Hover a pill on desktop — DevTools network panel shows a prefetch for the `game` query.

- [ ] **Step 4: If anything failed in step 3, file findings before claiming done**

Stop and surface any visual / behavioral bugs to the reviewer. Do not claim the plan is complete while a smoke step is failing.

- [ ] **Step 5: Final commit (if any small fixes were needed during smoke testing)**

If steps 1–3 surfaced trivial fixes (CSS tweak, typo), apply them and commit:

```bash
git add <changed files>
git commit -m "fix(slate): <specific fix>"
```

If no fixes needed, skip this step.
