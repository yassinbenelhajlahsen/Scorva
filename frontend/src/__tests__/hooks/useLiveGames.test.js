// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("../../api/games.js", () => ({
  getLiveGamesUrl: vi.fn((league) => `http://test/api/live/${league}/games`),
  getLeagueGames: vi.fn(),
}));

const { getLiveGamesUrl, getLeagueGames } = await import("../../api/games.js");
const { useLiveGames } = await import("../../hooks/live/useLiveGames.js");
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

describe("useLiveGames", () => {
  it("does nothing when league is null", () => {
    const { result } = renderHook(() => useLiveGames(null));
    expect(MockEventSource.instances).toHaveLength(0);
    expect(result.current.liveGamesMap).toBeNull();
  });

  it("opens EventSource with correct URL when league provided", () => {
    renderHook(() => useLiveGames("nba"));
    expect(MockEventSource.instances).toHaveLength(1);
    expect(getLiveGamesUrl).toHaveBeenCalledWith("nba");
  });

  it("accumulates partials into liveGamesMap on message events", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveGames("nba"));

    await act(async () => {
      MockEventSource.instances[0].dispatchMessage({ id: 1, status: "In Progress", homescore: 10, awayscore: 8 });
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.liveGamesMap).toBeInstanceOf(Map);
    expect(result.current.liveGamesMap.get(1)).toMatchObject({ id: 1, status: "In Progress", homescore: 10 });

    await act(async () => {
      MockEventSource.instances[0].dispatchMessage({ id: 2, status: "In Progress", homescore: 0, awayscore: 0 });
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.liveGamesMap.size).toBe(2);
    expect(result.current.liveGamesMap.get(2).status).toBe("In Progress");

    // Subsequent partial for id=1 merges in (not replaces wholesale).
    await act(async () => {
      MockEventSource.instances[0].dispatchMessage({ id: 1, homescore: 12 });
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.liveGamesMap.get(1)).toMatchObject({ id: 1, status: "In Progress", homescore: 12, awayscore: 8 });
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

  it("projects fetchFallback Game[] into liveGamesMap on REST polling fallback", async () => {
    vi.useFakeTimers();
    const fallbackGames = [{
      id: 1, status: "In Progress", homescore: 10, awayscore: 8, current_period: 2, clock: "5:00", date: "2026-05-10",
    }];
    getLeagueGames.mockResolvedValue(fallbackGames);

    const { result } = renderHook(() => useLiveGames("nba"));
    const es = MockEventSource.instances[0];

    await act(async () => {
      es.dispatchError(); es.dispatchError(); es.dispatchError();
    });
    expect(result.current.streamError).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    await act(async () => {});

    expect(getLeagueGames).toHaveBeenCalledWith("nba");
    expect(result.current.liveGamesMap).toBeInstanceOf(Map);
    expect(result.current.liveGamesMap.get(1)).toMatchObject({
      id: 1, status: "In Progress", homescore: 10, awayscore: 8, current_period: 2, clock: "5:00",
    });
    vi.useRealTimers();
  });

  it("resets failure count on successful message", async () => {
    const partial = { id: 1, status: "In Progress" };
    renderHook(() => useLiveGames("nba"));
    const es = MockEventSource.instances[0];

    act(() => {
      es.dispatchError();
      es.dispatchError();
      es.dispatchMessage(partial);
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

  it("reopens EventSource when tab becomes visible (covers silently-killed SSE)", () => {
    renderHook(() => useLiveGames("nba"));
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
    renderHook(() => useLiveGames("nba"));
    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      const ev = new Event("pageshow");
      Object.defineProperty(ev, "persisted", { value: true });
      window.dispatchEvent(ev);
    });

    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("does not reopen when league is null", () => {
    renderHook(() => useLiveGames(null));
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

    const { unmount } = renderHook(() => useLiveGames("nba"));
    unmount();

    expect(removeDoc).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(removeWin).toHaveBeenCalledWith("pageshow", expect.any(Function));
    expect(removeWin).toHaveBeenCalledWith("online", expect.any(Function));

    removeDoc.mockRestore();
    removeWin.mockRestore();
  });

  it("shares a single EventSource across multiple hooks for the same league", () => {
    renderHook(() => useLiveGames("nba"));
    renderHook(() => useLiveGames("nba"));
    renderHook(() => useLiveGames("nba"));
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("opens separate EventSources for different leagues", () => {
    renderHook(() => useLiveGames("nba"));
    renderHook(() => useLiveGames("nhl"));
    renderHook(() => useLiveGames("nfl"));
    expect(MockEventSource.instances).toHaveLength(3);
  });

  it("keeps EventSource open when one of multiple subscribers unmounts", () => {
    const a = renderHook(() => useLiveGames("nba"));
    const b = renderHook(() => useLiveGames("nba"));
    const es = MockEventSource.instances[0];
    expect(MockEventSource.instances).toHaveLength(1);

    a.unmount();
    expect(es.closed).toBeUndefined();

    b.unmount();
    expect(es.closed).toBe(true);
  });

  it("fans out a single partial to all subscribers", async () => {
    vi.useFakeTimers();
    const partial = { id: 1, status: "In Progress" };
    const a = renderHook(() => useLiveGames("nba"));
    const b = renderHook(() => useLiveGames("nba"));

    await act(async () => {
      MockEventSource.instances[0].dispatchMessage(partial);
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(a.result.current.liveGamesMap.get(1)).toMatchObject(partial);
    expect(b.result.current.liveGamesMap.get(1)).toMatchObject(partial);
    vi.useRealTimers();
  });

  it("replays accumulated map to late subscribers synchronously", async () => {
    vi.useFakeTimers();
    const partial = { id: 1, status: "In Progress" };

    renderHook(() => useLiveGames("nba"));
    await act(async () => {
      MockEventSource.instances[0].dispatchMessage(partial);
      await vi.advanceTimersByTimeAsync(1000);
    });

    const late = renderHook(() => useLiveGames("nba"));
    expect(late.result.current.liveGamesMap).toBeInstanceOf(Map);
    expect(late.result.current.liveGamesMap.get(1)).toMatchObject(partial);
    vi.useRealTimers();
  });
});
