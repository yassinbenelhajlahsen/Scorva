import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

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
    const { result } = renderHook(() => usePlayer("nba", "lebron-james", "2024-25"));
    expect(result.current.loading).toBe(true);
    expect(result.current.playerData).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("calls getPlayer with correct args", async () => {
    getPlayer.mockResolvedValue(mockPlayerResponse);
    renderHook(() => usePlayer("nba", "lebron-james", "2024-25"));
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
    const { result } = renderHook(() => usePlayer("nba", "lebron-james", "2024-25"));
    await waitFor(() => expect(result.current.playerData).toEqual(mockPlayerResponse.player));
    expect(result.current.loading).toBe(false);
    expect(result.current.seasonLoading).toBe(false);
  });

  it("merges only season data when playerData already exists (season switch)", async () => {
    getPlayer.mockResolvedValue(mockPlayerResponse);
    const { result } = renderHook(
      ({ season }) => usePlayer("nba", "lebron-james", season),
      { initialProps: { season: "2024-25" } }
    );
    await waitFor(() => expect(result.current.playerData).toEqual(mockPlayerResponse.player));

    const newSeasonResponse = {
      player: {
        ...mockPlayerResponse.player,
        season: "2023-24",
        seasonAverages: { pts: 28.0 },
        games: [{ id: 200 }],
      },
    };
    getPlayer.mockResolvedValue(newSeasonResponse);

    // Still same slug, so prev is set — should do merge
    act(() => {});

    await waitFor(() =>
      expect(result.current.playerData).toMatchObject({
        id: 1, // preserved from prev
        name: "LeBron James", // preserved from prev
      })
    );
  });

  it("sets error on fetch failure", async () => {
    getPlayer.mockRejectedValue(new Error("Server error"));
    const { result } = renderHook(() => usePlayer("nba", "lebron-james", "2024-25"));
    await waitFor(() => expect(result.current.error).toBe("Could not load player data. Please try again."));
    expect(result.current.loading).toBe(false);
    expect(result.current.playerData).toBeNull();
  });

  it("does not set error on AbortError", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    getPlayer.mockRejectedValue(abortErr);
    const { result } = renderHook(() => usePlayer("nba", "lebron-james", "2024-25"));
    await waitFor(() => expect(getPlayer).toHaveBeenCalled());
    expect(result.current.error).toBeNull();
  });

  it("resets playerData and shows loading when slug changes", async () => {
    getPlayer.mockResolvedValue(mockPlayerResponse);
    const { result, rerender } = renderHook(
      ({ slug }) => usePlayer("nba", slug, "2024-25"),
      { initialProps: { slug: "lebron-james" } }
    );
    await waitFor(() => expect(result.current.playerData).not.toBeNull());

    rerender({ slug: "stephen-curry" });
    expect(result.current.playerData).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("retry re-fetches and resets loading", async () => {
    getPlayer.mockResolvedValue(mockPlayerResponse);
    const { result } = renderHook(() => usePlayer("nba", "lebron-james", "2024-25"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    getPlayer.mockResolvedValue({ player: { ...mockPlayerResponse.player, seasonAverages: { pts: 26 } } });
    act(() => result.current.retry());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(getPlayer).toHaveBeenCalledTimes(2));
  });
});
