// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "../helpers/queryWrapper.jsx";

vi.mock("../../api/games.js", () => ({ getWinProbability: vi.fn() }));

const { getWinProbability } = await import("../../api/games.js");
const { useWinProbability } = await import("../../hooks/data/useWinProbability.js");

const SAMPLE_WIN_PROB = [
  { homeWinPercentage: 0.65, playId: "p1" },
  { homeWinPercentage: 0.82, playId: "p2" },
];

const SAMPLE_MARGIN = [
  { playId: "p1", margin: 0 },
  { playId: "p2", margin: 5 },
];

const SAMPLE_DATA = { winProbability: SAMPLE_WIN_PROB, scoreMargin: SAMPLE_MARGIN };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useWinProbability — initial state", () => {
  it("starts with loading=true and data=null", () => {
    getWinProbability.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useWinProbability("nba", "401585757", { isFinal: true }),
      { wrapper: createWrapper() }
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(false);
  });
});

describe("useWinProbability — no-op when inputs missing", () => {
  it("does not call getWinProbability when league is null", async () => {
    const { result } = renderHook(
      () => useWinProbability(null, "401585757", { isFinal: true }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getWinProbability).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("does not call getWinProbability when eventId is null", async () => {
    const { result } = renderHook(
      () => useWinProbability("nba", null, { isFinal: true }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getWinProbability).not.toHaveBeenCalled();
  });
});

describe("useWinProbability — successful fetch", () => {
  it("sets data and scoreMargin on success", async () => {
    getWinProbability.mockResolvedValue({ data: SAMPLE_DATA });
    const { result } = renderHook(
      () => useWinProbability("nba", "401585757", { isFinal: true }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.data).toEqual(SAMPLE_WIN_PROB));
    expect(result.current.scoreMargin).toEqual(SAMPLE_MARGIN);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("sets scoreMargin to null when response has no scoreMargin", async () => {
    getWinProbability.mockResolvedValue({
      data: { winProbability: SAMPLE_WIN_PROB, scoreMargin: null },
    });
    const { result } = renderHook(
      () => useWinProbability("nba", "401585757", { isFinal: true }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.data).toEqual(SAMPLE_WIN_PROB));
    expect(result.current.scoreMargin).toBeNull();
  });

  it("handles legacy flat-array response shape (backward compat)", async () => {
    getWinProbability.mockResolvedValue({ data: SAMPLE_WIN_PROB });
    const { result } = renderHook(
      () => useWinProbability("nba", "401585757", { isFinal: true }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.data).toEqual(SAMPLE_WIN_PROB));
    expect(result.current.scoreMargin).toBeNull();
  });

  it("sets data to null when response.data is null", async () => {
    getWinProbability.mockResolvedValue({ data: null });
    const { result } = renderHook(
      () => useWinProbability("nba", "401585757", { isFinal: true }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
  });

  it("passes isFinal=true to the API function", async () => {
    getWinProbability.mockResolvedValue({ data: SAMPLE_DATA });
    renderHook(
      () => useWinProbability("nba", "401585757", { isFinal: true }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(getWinProbability).toHaveBeenCalled());
    expect(getWinProbability).toHaveBeenCalledWith(
      "nba",
      "401585757",
      expect.objectContaining({ isFinal: true, signal: expect.any(AbortSignal) })
    );
  });

  it("re-fetches when eventId changes", async () => {
    getWinProbability.mockResolvedValue({ data: SAMPLE_DATA });
    const { rerender } = renderHook(
      ({ id }) => useWinProbability("nba", id, { isFinal: true }),
      { initialProps: { id: "111" }, wrapper: createWrapper() }
    );
    await waitFor(() =>
      expect(getWinProbability).toHaveBeenCalledWith("nba", "111", expect.any(Object))
    );

    rerender({ id: "222" });
    await waitFor(() =>
      expect(getWinProbability).toHaveBeenCalledWith("nba", "222", expect.any(Object))
    );
  });
});

describe("useWinProbability — error handling", () => {
  it("sets error=true on fetch failure", async () => {
    getWinProbability.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(
      () => useWinProbability("nba", "401585757", { isFinal: true }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
  });
});

describe("useWinProbability — live polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls every 30 seconds when isLive=true", async () => {
    getWinProbability.mockResolvedValue({ data: SAMPLE_DATA });

    renderHook(
      () => useWinProbability("nba", "401585757", { isFinal: false, isLive: true }),
      { wrapper: createWrapper() }
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(getWinProbability).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(getWinProbability).toHaveBeenCalledTimes(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(getWinProbability).toHaveBeenCalledTimes(3);
  });

  it("does not poll when isLive=false", async () => {
    getWinProbability.mockResolvedValue({ data: SAMPLE_DATA });

    renderHook(
      () => useWinProbability("nba", "401585757", { isFinal: true, isLive: false }),
      { wrapper: createWrapper() }
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(getWinProbability).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(getWinProbability).toHaveBeenCalledTimes(1);
  });

  it("clears interval on unmount", async () => {
    getWinProbability.mockResolvedValue({ data: SAMPLE_DATA });

    const { unmount } = renderHook(
      () => useWinProbability("nba", "401585757", { isFinal: false, isLive: true }),
      { wrapper: createWrapper() }
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(getWinProbability).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(getWinProbability).toHaveBeenCalledTimes(1);
  });
});
