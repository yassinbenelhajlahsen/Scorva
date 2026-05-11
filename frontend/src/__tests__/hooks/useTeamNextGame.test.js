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
      expect(ng?.status).toBe("In Progress - Q3");
      expect(ng?.teamScore).toBe(60);        // isHome=true so teamScore = homescore
      expect(ng?.opponentScore).toBe(55);
      expect(ng?.currentPeriod).toBe(3);
      expect(ng?.clock).toBe("5:42");
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
