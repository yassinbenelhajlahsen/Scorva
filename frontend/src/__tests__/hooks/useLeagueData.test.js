// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/games.js", () => ({ getLeagueGames: vi.fn() }));
vi.mock("../../api/teams.js", () => ({ getStandings: vi.fn() }));
vi.mock("../../hooks/live/useLiveGames.js", () => ({ useLiveGames: vi.fn() }));

const { getLeagueGames } = await import("../../api/games.js");
const { getStandings } = await import("../../api/teams.js");
const { useLiveGames } = await import("../../hooks/live/useLiveGames.js");
const { useLeagueData } = await import("../../hooks/data/useLeagueData.js");

beforeEach(() => {
  vi.clearAllMocks();
  getLeagueGames.mockResolvedValue([]);
  getStandings.mockResolvedValue([]);
  useLiveGames.mockReturnValue({ liveGames: null });
});

describe("useLeagueData — response shape handling", () => {
  it("unwraps { games, resolvedDate, resolvedSeason } when selectedDate is provided", async () => {
    getLeagueGames.mockResolvedValue({
      games: [{ id: 1, status: "Final" }],
      resolvedDate: "2025-01-15",
      resolvedSeason: "2024-25",
    });

    const { result } = renderHook(
      () => useLeagueData("nba", null, "2025-01-15"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.displayData).toBe(true));
    expect(result.current.games).toEqual([{ id: 1, status: "Final" }]);
    expect(result.current.resolvedDate).toBe("2025-01-15");
    expect(result.current.resolvedSeason).toBe("2024-25");
  });

  it("treats a flat array response as games when selectedDate is null", async () => {
    getLeagueGames.mockResolvedValue([
      { id: 1, status: "Final" },
      { id: 2, status: "Scheduled" },
    ]);

    const { result } = renderHook(
      () => useLeagueData("nba", null, null),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.displayData).toBe(true));
    expect(result.current.games).toEqual([
      { id: 1, status: "Final" },
      { id: 2, status: "Scheduled" },
    ]);
    expect(result.current.resolvedDate).toBeNull();
    expect(result.current.resolvedSeason).toBeNull();
  });

  it("exposes resolvedDate differing from selectedDate when backend redirected", async () => {
    getLeagueGames.mockResolvedValue({
      games: [{ id: 5 }],
      resolvedDate: "2025-01-14",
      resolvedSeason: "2024-25",
    });

    const { result } = renderHook(
      () => useLeagueData("nba", null, "2025-01-15"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.displayData).toBe(true));
    expect(result.current.resolvedDate).toBe("2025-01-14");
  });
});

describe("useLeagueData — API params", () => {
  it("passes selectedDate to getLeagueGames", async () => {
    renderHook(() => useLeagueData("nba", null, "2025-01-15"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getLeagueGames).toHaveBeenCalledTimes(1));
    expect(getLeagueGames).toHaveBeenCalledWith(
      "nba",
      expect.objectContaining({ date: "2025-01-15" })
    );
  });

  it("passes null date when selectedDate is null", async () => {
    renderHook(() => useLeagueData("nba", null, null), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getLeagueGames).toHaveBeenCalledTimes(1));
    expect(getLeagueGames).toHaveBeenCalledWith(
      "nba",
      expect.objectContaining({ date: null })
    );
  });

  it("passes season to getLeagueGames when selectedSeason is set", async () => {
    renderHook(() => useLeagueData("nba", "2024-25", null), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getLeagueGames).toHaveBeenCalledTimes(1));
    expect(getLeagueGames).toHaveBeenCalledWith(
      "nba",
      expect.objectContaining({ season: "2024-25" })
    );
  });
});

describe("useLeagueData — standings skip on date-only change", () => {
  it("fetches standings on initial load", async () => {
    renderHook(() => useLeagueData("nba", null, null), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(getStandings).toHaveBeenCalledTimes(1));
  });

  it("skips standings re-fetch when only date changes", async () => {
    getLeagueGames
      .mockResolvedValueOnce([{ id: 0, status: "Final" }])
      .mockResolvedValue({
        games: [],
        resolvedDate: "2025-01-15",
        resolvedSeason: "2025-26",
      });
    getStandings.mockResolvedValue([{ id: 1, conf: "east" }]);

    const { rerender } = renderHook(
      ({ date }) => useLeagueData("nba", null, date),
      { initialProps: { date: null }, wrapper: createWrapper() }
    );
    await waitFor(() => expect(getStandings).toHaveBeenCalledTimes(1));

    rerender({ date: "2025-01-15" });
    await waitFor(() => expect(getLeagueGames).toHaveBeenCalledTimes(2));
    // Standings key doesn't include date — TQ uses cached result, no new call
    expect(getStandings).toHaveBeenCalledTimes(1);
  });

  it("re-fetches standings when league changes", async () => {
    const { rerender } = renderHook(
      ({ league }) => useLeagueData(league, null, null),
      { initialProps: { league: "nba" }, wrapper: createWrapper() }
    );
    await waitFor(() => expect(getStandings).toHaveBeenCalledTimes(1));

    rerender({ league: "nhl" });
    await waitFor(() => expect(getStandings).toHaveBeenCalledTimes(2));
  });
});

describe("useLeagueData — SSE activation", () => {
  it("passes league to useLiveGames when viewing today with live games", async () => {
    const todayET = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    getLeagueGames.mockResolvedValue({
      games: [{ id: 1, status: "In Progress" }],
      resolvedDate: todayET,
      resolvedSeason: "2025-26",
    });

    renderHook(() => useLeagueData("nba", null, todayET), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      const calls = useLiveGames.mock.calls;
      expect(calls.some((c) => c[0] === "nba")).toBe(true);
    });
  });

  it("passes null to useLiveGames when selectedDate is a past date", async () => {
    getLeagueGames.mockResolvedValue({
      games: [{ id: 1, status: "Final" }],
      resolvedDate: "2025-01-10",
      resolvedSeason: "2024-25",
    });

    renderHook(() => useLeagueData("nba", null, "2025-01-10"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(getLeagueGames).toHaveBeenCalledTimes(1));
    const calls = useLiveGames.mock.calls;
    expect(calls.every((c) => c[0] === null)).toBe(true);
  });
});

describe("useLeagueData — SSE payload filter", () => {
  it("filters live SSE payload to selectedDate when set", async () => {
    const todayET = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    getLeagueGames.mockResolvedValue({
      games: [{ id: 1, status: "In Progress", date: `${todayET}T00:00:00.000Z` }],
      resolvedDate: todayET,
      resolvedSeason: "2025-26",
    });
    useLiveGames.mockReturnValue({
      liveGames: [
        { id: 1, status: "In Progress", date: `${todayET}T00:00:00.000Z` },
        { id: 2, status: "Scheduled", date: "2099-12-31T00:00:00.000Z" },
      ],
    });

    const { result } = renderHook(() => useLeagueData("nba", null, todayET), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.games.length).toBe(1));
    expect(result.current.games[0].id).toBe(1);
  });
});

describe("useLeagueData — error and retry", () => {
  it("sets error state when getLeagueGames rejects", async () => {
    getLeagueGames.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useLeagueData("nba", null, null), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(result.current.error).toBe("Failed to load data.")
    );
    expect(result.current.loading).toBe(false);
  });

  it("retry triggers a re-fetch", async () => {
    getLeagueGames.mockResolvedValue([]);
    const { result } = renderHook(() => useLeagueData("nba", null, null), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.displayData).toBe(true));

    act(() => { result.current.retry(); });
    await waitFor(() => expect(getLeagueGames).toHaveBeenCalledTimes(2));
  });
});
