import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/plays.js", () => ({ getGamePlays: vi.fn() }));

const { getGamePlays } = await import("../../api/plays.js");
const { usePlays } = await import("../../hooks/data/usePlays.js");

const mockPlaysData = { plays: [{ id: 1, description: "LeBron 2pt" }], source: "db" };

describe("usePlays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in loading state", () => {
    getGamePlays.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePlays("nba", 1, false), {
      wrapper: createWrapper(),
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(false);
    expect(result.current.plays).toBeNull();
  });

  it("fetches and sets plays on success", async () => {
    getGamePlays.mockResolvedValue(mockPlaysData);
    const { result } = renderHook(() => usePlays("nba", 1, false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.plays).toEqual(mockPlaysData));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("sets error on fetch failure", async () => {
    getGamePlays.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => usePlays("nba", 1, false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
  });

  it("treats 404 as empty plays (not an error)", async () => {
    getGamePlays.mockRejectedValue(new Error("HTTP 404"));
    const { result } = renderHook(() => usePlays("nba", 1, false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plays).toEqual({ plays: [] });
    expect(result.current.error).toBe(false);
  });

  it("retry re-fetches", async () => {
    getGamePlays.mockResolvedValue(mockPlaysData);
    const { result } = renderHook(() => usePlays("nba", 1, false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.plays).toEqual(mockPlaysData));

    act(() => result.current.retry());

    await waitFor(() => expect(getGamePlays).toHaveBeenCalledTimes(2));
  });

  describe("polling (fake timers)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not self-poll when isLive is true (updates driven by SSE invalidation)", async () => {
      getGamePlays.mockResolvedValue(mockPlaysData);
      renderHook(() => usePlays("nba", 1, true), { wrapper: createWrapper() });

      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(getGamePlays).toHaveBeenCalledTimes(1);

      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
      expect(getGamePlays).toHaveBeenCalledTimes(1);
    });

    it("does not poll when isLive is false", async () => {
      getGamePlays.mockResolvedValue(mockPlaysData);
      renderHook(() => usePlays("nba", 1, false), { wrapper: createWrapper() });

      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(getGamePlays).toHaveBeenCalledTimes(1);

      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
      expect(getGamePlays).toHaveBeenCalledTimes(1);
    });

    it("cleans up polling interval on unmount", async () => {
      getGamePlays.mockResolvedValue(mockPlaysData);
      const { unmount } = renderHook(() => usePlays("nba", 1, true), {
        wrapper: createWrapper(),
      });

      await act(async () => { await vi.advanceTimersByTimeAsync(0); });

      unmount();

      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
      expect(getGamePlays).toHaveBeenCalledTimes(1);
    });
  });
});
