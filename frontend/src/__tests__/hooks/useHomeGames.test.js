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
  useLiveGames.mockReturnValue({ liveGames: null });
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

  it("does not pass live league when no games are live", async () => {
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
    // Wait until hook re-renders with live game data (so useLiveGames gets "nba")
    await waitFor(() =>
      expect(useLiveGames).toHaveBeenCalledWith("nba")
    );
    expect(useLiveGames).toHaveBeenCalledWith(null);
  });

  it("updates games with liveGames data when available", async () => {
    getAllLeagueGames.mockResolvedValue(mockGames);
    useLiveGames.mockReturnValue({ liveGames: null });

    const { result, rerender } = renderHook(() => useHomeGames(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const liveNba = [{ id: 1, status: "In Progress", score: "55-50" }];
    useLiveGames.mockReturnValue({ liveGames: liveNba });
    rerender();

    await waitFor(() =>
      expect(result.current.games.nba).toEqual(liveNba)
    );
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
