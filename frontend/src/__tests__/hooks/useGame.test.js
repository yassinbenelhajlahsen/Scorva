// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/games.js", () => ({ getGameById: vi.fn() }));
vi.mock("../../hooks/live/useLiveGame.js", () => ({ useLiveGame: vi.fn() }));

const { getGameById } = await import("../../api/games.js");
const { useLiveGame } = await import("../../hooks/live/useLiveGame.js");
const { useGame } = await import("../../hooks/data/useGame.js");

const mockGameData = {
  json_build_object: {
    game: { id: 1, status: "Final", homeScore: 110, awayScore: 105 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  useLiveGame.mockReturnValue({ liveData: null });
});

describe("useGame", () => {
  it("starts in loading state", () => {
    getGameById.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useGame("nba", 1), {
      wrapper: createWrapper(),
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(false);
    expect(result.current.gameData).toBeNull();
  });

  it("calls getGameById with league and gameId", async () => {
    getGameById.mockResolvedValue(mockGameData);
    renderHook(() => useGame("nba", 1), { wrapper: createWrapper() });
    await waitFor(() =>
      expect(getGameById).toHaveBeenCalledWith(
        "nba",
        1,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
  });

  it("sets gameData and clears loading on success", async () => {
    getGameById.mockResolvedValue(mockGameData);
    const { result } = renderHook(() => useGame("nba", 1), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.gameData).toEqual(mockGameData));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("sets error on fetch failure", async () => {
    getGameById.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useGame("nba", 1), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
  });

  it("retry re-fetches game data", async () => {
    getGameById.mockResolvedValue(mockGameData);
    const { result } = renderHook(() => useGame("nba", 1), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.gameData).toEqual(mockGameData));

    getGameById.mockResolvedValue({ ...mockGameData, updated: true });
    act(() => result.current.retry());

    await waitFor(() => expect(getGameById).toHaveBeenCalledTimes(2));
  });

  it("does not start live polling for a Final game", async () => {
    getGameById.mockResolvedValue(mockGameData);
    renderHook(() => useGame("nba", 1), { wrapper: createWrapper() });
    await waitFor(() => expect(getGameById).toHaveBeenCalled());
    expect(useLiveGame).toHaveBeenCalledWith("nba", 1, false);
  });

  it("starts live polling for an in-progress game", async () => {
    const liveGame = {
      json_build_object: { game: { id: 1, status: "In Progress" } },
    };
    getGameById.mockResolvedValue(liveGame);
    renderHook(() => useGame("nba", 1), { wrapper: createWrapper() });
    await waitFor(() => expect(useLiveGame).toHaveBeenCalledWith("nba", 1, true));
  });

  it("updates gameData when liveData arrives", async () => {
    getGameById.mockResolvedValue(mockGameData);
    const liveUpdate = {
      json_build_object: { game: { id: 1, status: "In Progress", homeScore: 55 } },
    };

    useLiveGame.mockImplementation(() => ({ liveData: null }));

    const { result, rerender } = renderHook(() => useGame("nba", 1), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.gameData).toEqual(mockGameData));

    useLiveGame.mockReturnValue({ liveData: liveUpdate });
    rerender();

    await waitFor(() => expect(result.current.gameData).toEqual(liveUpdate));
  });
});
