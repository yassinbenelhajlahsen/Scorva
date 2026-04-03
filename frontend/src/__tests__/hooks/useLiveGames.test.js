import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../../api/games.js", () => ({
  getLiveGamesUrl: vi.fn((league) => `http://test/api/live/${league}/games`),
  getLeagueGames: vi.fn(),
}));

const { getLiveGamesUrl, getLeagueGames } = await import("../../api/games.js");
const { useLiveGames } = await import("../../hooks/live/useLiveGames.js");

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

class MockEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.onmessage = null;
    this.onerror = null;
    MockEventSource.instances.push(this);
  }
  addEventListener(type, fn) {
    this.listeners[type] = fn;
  }
  dispatchMessage(data) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }
  dispatchError() {
    if (this.onerror) this.onerror(new Event("error"));
  }
  dispatchDone() {
    if (this.listeners["done"]) this.listeners["done"](new Event("done"));
  }
  close() {
    this.closed = true;
  }
  static instances = [];
  static reset() {
    MockEventSource.instances = [];
  }
}

beforeEach(() => {
  MockEventSource.reset();
  vi.stubGlobal("EventSource", MockEventSource);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLiveGames", () => {
  it("does nothing when league is null", () => {
    const { result } = renderHook(() => useLiveGames(null));
    expect(MockEventSource.instances).toHaveLength(0);
    expect(result.current.liveGames).toBeNull();
  });

  it("opens EventSource with correct URL when league provided", () => {
    renderHook(() => useLiveGames("nba"));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(getLiveGamesUrl).toHaveBeenCalledWith("nba");
  });

  it("updates liveGames state on message event", async () => {
    vi.useFakeTimers();
    const mockGames = [{ id: 1, status: "In Progress" }];
    const { result } = renderHook(() => useLiveGames("nba"));

    await act(async () => {
      MockEventSource.instances[0].dispatchMessage(mockGames);
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.liveGames).toEqual(mockGames);
    vi.useRealTimers();
  });

  it("closes EventSource on done event", async () => {
    renderHook(() => useLiveGames("nba"));
    const es = MockEventSource.instances[0];

    act(() => {
      es.dispatchDone();
    });

    await waitFor(() => {
      expect(es.closed).toBe(true);
    });
  });

  it("falls back to REST polling after 3 consecutive errors", async () => {
    vi.useFakeTimers();
    const mockGames = [{ id: 1, status: "In Progress" }];
    getLeagueGames.mockResolvedValue(mockGames);

    const { result } = renderHook(() => useLiveGames("nba"));
    const es = MockEventSource.instances[0];

    await act(async () => {
      es.dispatchError();
      es.dispatchError();
      es.dispatchError();
    });

    // Don't use waitFor with fake timers — check state directly after act
    expect(result.current.streamError).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await act(async () => {});

    expect(getLeagueGames).toHaveBeenCalledWith("nba");

    vi.useRealTimers();
  });

  it("resets failure count on successful message", async () => {
    const mockGames = [{ id: 1, status: "In Progress" }];
    renderHook(() => useLiveGames("nba"));
    const es = MockEventSource.instances[0];

    // Two errors then a success — should NOT trigger fallback
    act(() => {
      es.dispatchError();
      es.dispatchError();
      es.dispatchMessage(mockGames);
      es.dispatchError(); // failure count resets so this is only 1
    });

    expect(getLeagueGames).not.toHaveBeenCalled();
  });

  it("closes EventSource on unmount", () => {
    const { unmount } = renderHook(() => useLiveGames("nba"));
    const es = MockEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });
});
