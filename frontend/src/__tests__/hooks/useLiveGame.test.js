import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../../api/games.js", () => ({
  getLiveGameUrl: vi.fn((league, gameId) => `http://test/api/live/${league}/games/${gameId}`),
  getGameById: vi.fn(),
}));

const { getLiveGameUrl, getGameById } = await import("../../api/games.js");
const { useLiveGame } = await import("../../hooks/live/useLiveGame.js");

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

describe("useLiveGame", () => {
  it("does not open EventSource when isLive is false", () => {
    renderHook(() => useLiveGame("nba", "1", false));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("does not open EventSource when league or gameId missing", () => {
    renderHook(() => useLiveGame(null, "1", true));
    renderHook(() => useLiveGame("nba", null, true));
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("opens EventSource with correct URL when live", () => {
    renderHook(() => useLiveGame("nba", "42", true));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(getLiveGameUrl).toHaveBeenCalledWith("nba", "42");
  });

  it("sets isStreaming true when EventSource opens", () => {
    const { result } = renderHook(() => useLiveGame("nba", "1", true));
    expect(result.current.isStreaming).toBe(true);
  });

  it("updates liveData on message event", async () => {
    vi.useFakeTimers();
    const mockGame = { json_build_object: { game: { id: 1, status: "In Progress" } } };
    const { result } = renderHook(() => useLiveGame("nba", "1", true));

    await act(async () => {
      MockEventSource.instances[0].dispatchMessage(mockGame);
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.liveData).toEqual(mockGame);
    vi.useRealTimers();
  });

  it("closes stream and sets isStreaming false on done event", async () => {
    const { result } = renderHook(() => useLiveGame("nba", "1", true));
    const es = MockEventSource.instances[0];

    act(() => {
      es.dispatchDone();
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
      expect(es.closed).toBe(true);
    });
  });

  it("falls back to REST polling after 3 consecutive errors", async () => {
    vi.useFakeTimers();
    const mockGame = { json_build_object: { game: { id: 1 } } };
    getGameById.mockResolvedValue(mockGame);

    const { result } = renderHook(() => useLiveGame("nba", "1", true));
    const es = MockEventSource.instances[0];

    await act(async () => {
      es.dispatchError();
      es.dispatchError();
      es.dispatchError();
    });

    // Don't use waitFor with fake timers — check state directly after act
    expect(result.current.connectionError).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await act(async () => {});

    expect(getGameById).toHaveBeenCalledWith("nba", "1");

    vi.useRealTimers();
  });

  it("closes EventSource on unmount", () => {
    const { unmount } = renderHook(() => useLiveGame("nba", "1", true));
    const es = MockEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });

  it("re-opens EventSource when league/gameId changes", () => {
    const { rerender } = renderHook(
      ({ league, gameId }) => useLiveGame(league, gameId, true),
      { initialProps: { league: "nba", gameId: "1" } }
    );
    expect(MockEventSource.instances).toHaveLength(1);

    rerender({ league: "nba", gameId: "2" });
    // Old one closed, new one opened
    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(2);
  });
});
