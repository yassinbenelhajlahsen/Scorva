import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/players.js", () => ({ getPlayer: vi.fn() }));

const { getPlayer } = await import("../../api/players.js");
const { usePlayer } = await import("../../hooks/data/usePlayer.js");

const mockPlayerResponse = {
  player: {
    id: 1,
    name: "LeBron James",
    season: "2024-25",
    team: { id: 1, name: "Lakers" },
    seasonAverages: { pts: 25.5 },
    games: [{ id: 101 }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usePlayer", () => {
  it("starts in loading state", () => {
    getPlayer.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => usePlayer("nba", "lebron-james", "2024-25"),
      { wrapper: createWrapper() }
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.playerData).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("calls getPlayer with correct args", async () => {
    getPlayer.mockResolvedValue(mockPlayerResponse);
    renderHook(() => usePlayer("nba", "lebron-james", "2024-25"), {
      wrapper: createWrapper(),
    });
    await waitFor(() =>
      expect(getPlayer).toHaveBeenCalledWith(
        "nba",
        "lebron-james",
        expect.objectContaining({ season: "2024-25", signal: expect.any(AbortSignal) })
      )
    );
  });

  it("sets playerData from response.player on first load", async () => {
    getPlayer.mockResolvedValue(mockPlayerResponse);
    const { result } = renderHook(
      () => usePlayer("nba", "lebron-james", "2024-25"),
      { wrapper: createWrapper() }
    );
    await waitFor(() =>
      expect(result.current.playerData).toEqual(mockPlayerResponse.player)
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.seasonLoading).toBe(false);
  });

  it("shows previous player data while season is loading (season switch)", async () => {
    getPlayer.mockResolvedValue(mockPlayerResponse);
    const { result, rerender } = renderHook(
      ({ season }) => usePlayer("nba", "lebron-james", season),
      { initialProps: { season: "2024-25" }, wrapper: createWrapper() }
    );
    await waitFor(() =>
      expect(result.current.playerData).toEqual(mockPlayerResponse.player)
    );

    const newSeasonResponse = {
      player: {
        ...mockPlayerResponse.player,
        season: "2023-24",
        seasonAverages: { pts: 28.0 },
        games: [{ id: 200 }],
      },
    };
    getPlayer.mockResolvedValue(newSeasonResponse);
    rerender({ season: "2023-24" });

    // Previous player data still visible (id and name preserved from placeholder)
    await waitFor(() =>
      expect(result.current.playerData).toMatchObject({
        id: 1,
        name: "LeBron James",
      })
    );
  });

  it("sets error on fetch failure", async () => {
    getPlayer.mockRejectedValue(new Error("Server error"));
    const { result } = renderHook(
      () => usePlayer("nba", "lebron-james", "2024-25"),
      { wrapper: createWrapper() }
    );
    await waitFor(() =>
      expect(result.current.error).toBe(
        "Could not load player data. Please try again."
      )
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.playerData).toBeNull();
  });

  it("clears playerData when slug changes (new player navigation)", async () => {
    getPlayer.mockResolvedValue(mockPlayerResponse);
    const { result, rerender } = renderHook(
      ({ slug }) => usePlayer("nba", slug, "2024-25"),
      { initialProps: { slug: "lebron-james" }, wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.playerData).not.toBeNull());

    getPlayer.mockReturnValue(new Promise(() => {})); // pending for new player
    rerender({ slug: "stephen-curry" });

    await waitFor(() => expect(result.current.playerData).toBeNull());
    expect(result.current.loading).toBe(true);
  });

  it("retry re-fetches", async () => {
    getPlayer.mockResolvedValue(mockPlayerResponse);
    const { result } = renderHook(
      () => usePlayer("nba", "lebron-james", "2024-25"),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    getPlayer.mockResolvedValue({
      player: { ...mockPlayerResponse.player, seasonAverages: { pts: 26 } },
    });
    act(() => result.current.retry());

    await waitFor(() => expect(getPlayer).toHaveBeenCalledTimes(2));
  });
});
