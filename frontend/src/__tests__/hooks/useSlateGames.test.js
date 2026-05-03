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
