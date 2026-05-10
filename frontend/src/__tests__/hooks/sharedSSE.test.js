// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { subscribeSSE, forceReconnect, __resetForTests } = await import(
  "../../hooks/live/sharedSSE.js"
);

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
  __resetForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sharedSSE", () => {
  it("opens one EventSource on first subscribe", () => {
    subscribeSSE("http://test/a", { fetchFallback: () => Promise.resolve() }, () => {});
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("http://test/a");
  });

  it("does not open a second EventSource when same URL is subscribed twice", () => {
    const opts = { fetchFallback: () => Promise.resolve() };
    subscribeSSE("http://test/a", opts, () => {});
    subscribeSSE("http://test/a", opts, () => {});
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("opens distinct EventSources for distinct URLs", () => {
    const opts = { fetchFallback: () => Promise.resolve() };
    subscribeSSE("http://test/a", opts, () => {});
    subscribeSSE("http://test/b", opts, () => {});
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("broadcasts isStreaming:true synchronously to the first subscriber", () => {
    const snapshots = [];
    subscribeSSE("http://test/a", { fetchFallback: () => Promise.resolve() }, (s) =>
      snapshots.push(s),
    );
    expect(snapshots).toEqual([{ isStreaming: true }]);
  });

  it("replays the cached snapshot synchronously to a late subscriber", async () => {
    vi.useFakeTimers();
    const optsA = { fetchFallback: () => Promise.resolve() };
    subscribeSSE("http://test/a", optsA, () => {});
    MockEventSource.instances[0].dispatchMessage([{ id: 1 }]);
    await vi.advanceTimersByTimeAsync(1000);

    const lateSnapshots = [];
    subscribeSSE("http://test/a", optsA, (s) => lateSnapshots.push(s));
    expect(lateSnapshots).toHaveLength(1);
    expect(lateSnapshots[0]).toMatchObject({
      isStreaming: true,
      data: [{ id: 1 }],
    });
    vi.useRealTimers();
  });

  it("fans messages out to all subscribers", async () => {
    vi.useFakeTimers();
    const a = [];
    const b = [];
    const opts = { fetchFallback: () => Promise.resolve() };
    subscribeSSE("http://test/a", opts, (s) => a.push(s));
    subscribeSSE("http://test/a", opts, (s) => b.push(s));

    MockEventSource.instances[0].dispatchMessage({ x: 1 });
    await vi.advanceTimersByTimeAsync(1000);

    expect(a.find((s) => s.data !== undefined)).toEqual({ data: { x: 1 } });
    expect(b.find((s) => s.data !== undefined)).toEqual({ data: { x: 1 } });
    vi.useRealTimers();
  });

  it("closes EventSource only when refcount reaches zero", () => {
    const opts = { fetchFallback: () => Promise.resolve() };
    const unsubA = subscribeSSE("http://test/a", opts, () => {});
    const unsubB = subscribeSSE("http://test/a", opts, () => {});
    const es = MockEventSource.instances[0];

    unsubA();
    expect(es.closed).toBeUndefined();

    unsubB();
    expect(es.closed).toBe(true);
  });

  it("forceReconnect closes and reopens the shared EventSource", () => {
    const opts = { fetchFallback: () => Promise.resolve() };
    subscribeSSE("http://test/a", opts, () => {});
    const first = MockEventSource.instances[0];

    forceReconnect("http://test/a");
    expect(first.closed).toBe(true);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("forceReconnect is a no-op when URL has no subscribers", () => {
    forceReconnect("http://test/unknown");
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("done event marks state done and broadcasts isStreaming:false (NOT streamError)", () => {
    const snapshots = [];
    subscribeSSE("http://test/a", { fetchFallback: () => Promise.resolve() }, (s) =>
      snapshots.push(s),
    );
    const es = MockEventSource.instances[0];
    es.dispatchDone();

    expect(es.closed).toBe(true);
    const lastPatch = snapshots.at(-1);
    expect(lastPatch).toEqual({ isStreaming: false });
    // crucial: done must NOT trigger streamError; otherwise useLiveGames
    // consumers see a spurious error UI on normal stream completion.
    expect(snapshots.some((p) => p.streamError === true)).toBe(false);
  });

  it("forceReconnect is a no-op after done", () => {
    subscribeSSE("http://test/a", { fetchFallback: () => Promise.resolve() }, () => {});
    MockEventSource.instances[0].dispatchDone();

    forceReconnect("http://test/a");
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("falls back to REST polling after 3 errors and broadcasts streamError to all", async () => {
    vi.useFakeTimers();
    const fetchFallback = vi.fn().mockResolvedValue([{ id: 1 }]);
    const a = [];
    const b = [];
    subscribeSSE("http://test/a", { fetchFallback }, (s) => a.push(s));
    subscribeSSE("http://test/a", { fetchFallback }, (s) => b.push(s));
    const es = MockEventSource.instances[0];

    es.dispatchError();
    es.dispatchError();
    es.dispatchError();

    expect(a.some((s) => s.streamError === true)).toBe(true);
    expect(b.some((s) => s.streamError === true)).toBe(true);
    expect(es.closed).toBe(true);

    await vi.advanceTimersByTimeAsync(30_000);
    await Promise.resolve();
    expect(fetchFallback).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("resets failure count on a successful message", async () => {
    vi.useFakeTimers();
    const fetchFallback = vi.fn();
    subscribeSSE("http://test/a", { fetchFallback }, () => {});
    const es = MockEventSource.instances[0];

    es.dispatchError();
    es.dispatchError();
    es.dispatchMessage([{ id: 1 }]);
    es.dispatchError(); // counter reset → only 1 → no fallback

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchFallback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
