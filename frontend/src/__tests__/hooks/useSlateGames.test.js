// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
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
  useLiveGames.mockReturnValue({ liveGamesMap: null });
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

  it("subscribes to SSE when there is a live game", async () => {
    getLeagueGames.mockResolvedValue({
      games: [{ id: 1, status: "In Progress" }],
      resolvedDate: "2026-05-02",
    });

    const { result } = renderHook(() => useSlateGames("nba"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const lastCall = useLiveGames.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("nba");
  });

  it("subscribes to SSE for a Scheduled-only slate so tip-offs are caught", async () => {
    getLeagueGames.mockResolvedValue({
      games: [{ id: 1, status: "Scheduled" }],
      resolvedDate: "2026-05-02",
    });

    const { result } = renderHook(() => useSlateGames("nba"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const lastCall = useLiveGames.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("nba");
  });

  it("refetches on visibilitychange→visible", async () => {
    getLeagueGames.mockResolvedValue({ games: [], resolvedDate: "2026-05-02" });
    renderHook(() => useSlateGames("nba"), { wrapper: createWrapper() });
    await waitFor(() => expect(getLeagueGames).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(getLeagueGames).toHaveBeenCalledTimes(2));
  });

  it("does not refetch on visibility when enabled is false", async () => {
    getLeagueGames.mockResolvedValue({ games: [], resolvedDate: "2026-05-02" });
    renderHook(() => useSlateGames("nba", { enabled: false }), {
      wrapper: createWrapper(),
    });

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(getLeagueGames).not.toHaveBeenCalled();
  });

  it("does NOT subscribe to SSE when slate is all terminal", async () => {
    getLeagueGames.mockResolvedValue({
      games: [
        { id: 1, status: "Final" },
        { id: 2, status: "Postponed" },
      ],
      resolvedDate: "2026-05-02",
    });

    renderHook(() => useSlateGames("nba"), { wrapper: createWrapper() });

    await waitFor(() => expect(getLeagueGames).toHaveBeenCalled());
    const lastCall = useLiveGames.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(null);
  });

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
      expect(live?.status).toBe("In Progress - Q3");
      expect(live?.homescore).toBe(55);
    });
    expect(result.current.games.find((g) => g.id === 1)).toMatchObject({
      id: 1, home_team_name: "Suns", current_period: 3,
    });
    expect(result.current.games.find((g) => g.id === 2)).toMatchObject({
      id: 2, status: "Final", homescore: 100,
    });
  });
});
