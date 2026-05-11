// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../../api/games.js", () => ({
  getLiveGameUrl: vi.fn((league, gameId) => `http://test/api/live/${league}/games/${gameId}`),
  getGameById: vi.fn(),
}));

const { getLiveGameUrl, getGameById } = await import("../../api/games.js");
const { useLiveGame } = await import("../../hooks/live/useLiveGame.js");
const { __resetForTests } = await import("../../hooks/live/sharedSSE.js");

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
  __resetForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLiveGame", () => {
  it("does not open EventSource when enabled is false", () => {
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

  it("reopens EventSource when tab becomes visible (covers silently-killed SSE)", () => {
    renderHook(() => useLiveGame("nba", "1", true));
    expect(MockEventSource.instances).toHaveLength(1);

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("reopens EventSource on pageshow with persisted=true (bfcache restore)", () => {
    renderHook(() => useLiveGame("nba", "1", true));
    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      const ev = new Event("pageshow");
      Object.defineProperty(ev, "persisted", { value: true });
      window.dispatchEvent(ev);
    });

    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("does not reopen when hook is disabled", () => {
    renderHook(() => useLiveGame("nba", "1", false));
    expect(MockEventSource.instances).toHaveLength(0);

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("removes visibility/pageshow/online listeners on unmount", () => {
    const removeDoc = vi.spyOn(document, "removeEventListener");
    const removeWin = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useLiveGame("nba", "1", true));
    unmount();

    expect(removeDoc).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(removeWin).toHaveBeenCalledWith("pageshow", expect.any(Function));
    expect(removeWin).toHaveBeenCalledWith("online", expect.any(Function));

    removeDoc.mockRestore();
    removeWin.mockRestore();
  });

  it("shares a single EventSource across multiple hooks for the same (league, gameId)", () => {
    renderHook(() => useLiveGame("nba", "1", true));
    renderHook(() => useLiveGame("nba", "1", true));
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("fans streamError out as connectionError to all subscribers for the same game", async () => {
    getGameById.mockResolvedValue({});
    const a = renderHook(() => useLiveGame("nba", "1", true));
    const b = renderHook(() => useLiveGame("nba", "1", true));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(a.result.current.connectionError).toBe(false);
    expect(b.result.current.connectionError).toBe(false);

    const es = MockEventSource.instances[0];
    await act(async () => {
      es.dispatchError();
      es.dispatchError();
      es.dispatchError();
    });

    expect(a.result.current.connectionError).toBe(true);
    expect(b.result.current.connectionError).toBe(true);
    expect(a.result.current.isStreaming).toBe(false);
    expect(b.result.current.isStreaming).toBe(false);
  });

  it("keeps EventSource open when one subscriber disables (enabled flips false)", () => {
    const a = renderHook(
      ({ enabled }) => useLiveGame("nba", "1", enabled),
      { initialProps: { enabled: true } },
    );
    const b = renderHook(() => useLiveGame("nba", "1", true));
    const es = MockEventSource.instances[0];
    expect(MockEventSource.instances).toHaveLength(1);

    // Subscriber A flips enabled=false — must not close the shared ES,
    // since subscriber B still has it open.
    a.rerender({ enabled: false });
    expect(es.closed).toBeUndefined();

    b.unmount();
    expect(es.closed).toBe(true);
  });
});
