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
