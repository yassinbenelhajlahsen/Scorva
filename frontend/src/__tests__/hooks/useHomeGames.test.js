// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/games.js", () => ({ getAllLeagueGames: vi.fn() }));
vi.mock("../../hooks/live/useLiveGames.js", () => ({ useLiveGames: vi.fn() }));

const { getAllLeagueGames } = await import("../../api/games.js");
const { useLiveGames } = await import("../../hooks/live/useLiveGames.js");
const { useHomeGames } = await import("../../hooks/data/useHomeGames.js");

const mockGames = {
  nba: [{ id: 1, status: "Final" }],
  nhl: [{ id: 2, status: "Final" }],
  nfl: [{ id: 3, status: "Final" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  useLiveGames.mockReturnValue({ liveGamesMap: null });
});

describe("useHomeGames", () => {
  it("starts in loading state with empty games", () => {
    getAllLeagueGames.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useHomeGames(), {
      wrapper: createWrapper(),
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.games).toEqual({ nba: [], nhl: [], nfl: [] });
    expect(result.current.error).toBeNull();
  });

  it("sets games and clears loading on success", async () => {
    getAllLeagueGames.mockResolvedValue(mockGames);
    const { result } = renderHook(() => useHomeGames(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.games).toEqual(mockGames);
    expect(result.current.error).toBeNull();
  });

  it("calls getAllLeagueGames with an AbortSignal", async () => {
    getAllLeagueGames.mockResolvedValue(mockGames);
    renderHook(() => useHomeGames(), { wrapper: createWrapper() });
    await waitFor(() =>
      expect(getAllLeagueGames).toHaveBeenCalledWith(expect.any(AbortSignal))
    );
  });

  it("sets error on fetch failure", async () => {
    getAllLeagueGames.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useHomeGames(), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(result.current.error).toBe(
        "Could not load games. Please try again later."
      )
    );
    expect(result.current.loading).toBe(false);
  });

  it("does not pass any league when every slate is terminal", async () => {
    getAllLeagueGames.mockResolvedValue(mockGames);
    renderHook(() => useHomeGames(), { wrapper: createWrapper() });
    await waitFor(() => expect(getAllLeagueGames).toHaveBeenCalled());
    expect(useLiveGames).toHaveBeenCalledWith(null);
  });

  it("passes live league when a game is in progress", async () => {
    const liveGamesData = {
      nba: [{ id: 1, status: "In Progress" }],
      nhl: [{ id: 2, status: "Final" }],
      nfl: [{ id: 3, status: "Final" }],
    };
    getAllLeagueGames.mockResolvedValue(liveGamesData);
    renderHook(() => useHomeGames(), { wrapper: createWrapper() });
    await waitFor(() =>
      expect(useLiveGames).toHaveBeenCalledWith("nba")
    );
    expect(useLiveGames).toHaveBeenCalledWith(null);
  });

  it("passes live league when only Scheduled games are present so tip-offs are caught", async () => {
    const scheduledOnly = {
      nba: [{ id: 1, status: "Scheduled" }],
      nhl: [{ id: 2, status: "Final" }],
      nfl: [{ id: 3, status: "Final" }],
    };
    getAllLeagueGames.mockResolvedValue(scheduledOnly);
    renderHook(() => useHomeGames(), { wrapper: createWrapper() });
    await waitFor(() =>
      expect(useLiveGames).toHaveBeenCalledWith("nba")
    );
  });

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

  it("refetches on visibilitychange→visible", async () => {
    getAllLeagueGames.mockResolvedValue(mockGames);
    renderHook(() => useHomeGames(), { wrapper: createWrapper() });
    await waitFor(() => expect(getAllLeagueGames).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(getAllLeagueGames).toHaveBeenCalledTimes(2));
  });

  it("does not refetch when visibilityState is hidden", async () => {
    getAllLeagueGames.mockResolvedValue(mockGames);
    renderHook(() => useHomeGames(), { wrapper: createWrapper() });
    await waitFor(() => expect(getAllLeagueGames).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(getAllLeagueGames).toHaveBeenCalledTimes(1);
  });

  it("retry re-fetches games", async () => {
    getAllLeagueGames.mockResolvedValue(mockGames);
    const { result } = renderHook(() => useHomeGames(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.retry());
    await waitFor(() => expect(getAllLeagueGames).toHaveBeenCalledTimes(2));
  });
});
