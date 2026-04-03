import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("../../api/games.js", () => ({ getGameDates: vi.fn() }));

const { getGameDates } = await import("../../api/games.js");
const { useGameDates } = await import("../../hooks/useGameDates.js");

// Helper to build the API response shape
function makeDates(pairs) {
  return pairs.map(([date, count]) => ({ date, count }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useGameDates", () => {
  it("starts with empty dates, empty gameCounts, and loading true", () => {
    getGameDates.mockResolvedValue([]);
    const { result } = renderHook(() => useGameDates("nba"));
    expect(result.current.dates).toEqual([]);
    expect(result.current.gameCounts).toEqual(new Map());
    expect(result.current.loading).toBe(true);
  });

  it("fetches dates and sets loading false on success", async () => {
    getGameDates.mockResolvedValue(makeDates([["2025-01-15", 8], ["2025-01-16", 3]]));
    const { result } = renderHook(() => useGameDates("nba"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dates).toEqual(["2025-01-15", "2025-01-16"]);
  });

  it("populates gameCounts as a Map of date → number", async () => {
    getGameDates.mockResolvedValue(makeDates([["2025-01-15", 8], ["2025-01-16", 3]]));
    const { result } = renderHook(() => useGameDates("nba"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.gameCounts.get("2025-01-15")).toBe(8);
    expect(result.current.gameCounts.get("2025-01-16")).toBe(3);
  });

  it("calls getGameDates with league and undefined season when no season provided", async () => {
    getGameDates.mockResolvedValue([]);
    renderHook(() => useGameDates("nba"));
    await waitFor(() => expect(getGameDates).toHaveBeenCalledTimes(1));
    expect(getGameDates).toHaveBeenCalledWith(
      "nba",
      expect.objectContaining({ season: undefined })
    );
  });

  it("calls getGameDates with explicit season when provided", async () => {
    getGameDates.mockResolvedValue([]);
    renderHook(() => useGameDates("nba", "2024-25"));
    await waitFor(() => expect(getGameDates).toHaveBeenCalledTimes(1));
    expect(getGameDates).toHaveBeenCalledWith(
      "nba",
      expect.objectContaining({ season: "2024-25" })
    );
  });

  it("passes an AbortSignal to getGameDates", async () => {
    getGameDates.mockResolvedValue([]);
    renderHook(() => useGameDates("nba"));
    await waitFor(() => expect(getGameDates).toHaveBeenCalledTimes(1));
    expect(getGameDates).toHaveBeenCalledWith(
      "nba",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("re-fetches when the league changes", async () => {
    getGameDates.mockResolvedValue([]);
    const { rerender } = renderHook(({ league }) => useGameDates(league), {
      initialProps: { league: "nba" },
    });
    await waitFor(() => expect(getGameDates).toHaveBeenCalledTimes(1));

    rerender({ league: "nhl" });
    await waitFor(() => expect(getGameDates).toHaveBeenCalledTimes(2));
    expect(getGameDates).toHaveBeenLastCalledWith("nhl", expect.anything());
  });

  it("re-fetches when the season changes", async () => {
    getGameDates.mockResolvedValue([]);
    const { rerender } = renderHook(({ season }) => useGameDates("nba", season), {
      initialProps: { season: "2024-25" },
    });
    await waitFor(() => expect(getGameDates).toHaveBeenCalledTimes(1));

    rerender({ season: "2023-24" });
    await waitFor(() => expect(getGameDates).toHaveBeenCalledTimes(2));
    expect(getGameDates).toHaveBeenLastCalledWith(
      "nba",
      expect.objectContaining({ season: "2023-24" })
    );
  });

  it("sets loading false and keeps empty dates on non-abort error", async () => {
    getGameDates.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useGameDates("nba"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dates).toEqual([]);
  });

  it("does not set loading false on AbortError", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    getGameDates.mockRejectedValue(abortErr);
    const { result } = renderHook(() => useGameDates("nba"));
    await waitFor(() => expect(getGameDates).toHaveBeenCalled());
    // loading stays true — abort is cleanup, not a real error
    expect(result.current.loading).toBe(true);
  });

  it("resets dates and gameCounts to empty before each fetch", async () => {
    getGameDates
      .mockResolvedValueOnce(makeDates([["2025-01-15", 5]]))
      .mockResolvedValueOnce([]);

    const { result, rerender } = renderHook(({ league }) => useGameDates(league), {
      initialProps: { league: "nba" },
    });
    await waitFor(() => expect(result.current.dates).toEqual(["2025-01-15"]));

    rerender({ league: "nhl" });
    // dates and gameCounts reset immediately on league change
    expect(result.current.dates).toEqual([]);
    expect(result.current.gameCounts).toEqual(new Map());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
