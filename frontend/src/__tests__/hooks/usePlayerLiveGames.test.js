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
