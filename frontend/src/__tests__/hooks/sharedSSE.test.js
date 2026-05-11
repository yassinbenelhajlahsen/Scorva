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

  it("debounces rapid forceReconnect calls so N subscribers cause one reconnect", () => {
    vi.useFakeTimers();
    const opts = { fetchFallback: () => Promise.resolve() };
    subscribeSSE("http://test/a", opts, () => {});
    subscribeSSE("http://test/a", opts, () => {});
    subscribeSSE("http://test/a", opts, () => {});
    expect(MockEventSource.instances).toHaveLength(1);

    // Three near-simultaneous reconnect calls (one per subscriber on visibility return).
    forceReconnect("http://test/a");
    forceReconnect("http://test/a");
    forceReconnect("http://test/a");

    // Only the first should land; subsequent calls within the debounce window
    // are no-ops, so we end up with exactly one reconnect (2 ES instances total).
    expect(MockEventSource.instances).toHaveLength(2);
    vi.useRealTimers();
  });

  it("allows another forceReconnect after the debounce window elapses", () => {
    vi.useFakeTimers();
    subscribeSSE("http://test/a", { fetchFallback: () => Promise.resolve() }, () => {});
    forceReconnect("http://test/a");
    expect(MockEventSource.instances).toHaveLength(2);

    // Another call inside the debounce window: blocked.
    vi.advanceTimersByTime(500);
    forceReconnect("http://test/a");
    expect(MockEventSource.instances).toHaveLength(2);

    // Past the window: allowed again.
    vi.advanceTimersByTime(600);
    forceReconnect("http://test/a");
    expect(MockEventSource.instances).toHaveLength(3);
    vi.useRealTimers();
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

  describe("accumulate option", () => {
    it("applies accumulate(prev, next) to each message and stores accumulated data", async () => {
      vi.useFakeTimers();
      const accumulate = (prev, patch) => {
        const next = new Map(prev ?? []);
        next.set(patch.id, { ...next.get(patch.id), ...patch });
        return next;
      };
      const snapshots = [];
      subscribeSSE(
        "http://test/acc",
        { fetchFallback: () => Promise.resolve(), accumulate },
        (s) => snapshots.push(s),
      );
      const es = MockEventSource.instances[0];

      es.dispatchMessage({ id: 1, score: 5 });
      await vi.advanceTimersByTimeAsync(1000);
      es.dispatchMessage({ id: 2, score: 7 });
      await vi.advanceTimersByTimeAsync(1000);
      es.dispatchMessage({ id: 1, score: 9 });
      await vi.advanceTimersByTimeAsync(1000);

      const last = snapshots.at(-1).data;
      expect(last).toBeInstanceOf(Map);
      expect(last.get(1)).toEqual({ id: 1, score: 9 });
      expect(last.get(2)).toEqual({ id: 2, score: 7 });
      vi.useRealTimers();
    });

    it("replays accumulated data (not just last message) to late subscribers", async () => {
      vi.useFakeTimers();
      const accumulate = (prev, patch) => {
        const next = new Map(prev ?? []);
        next.set(patch.id, { ...next.get(patch.id), ...patch });
        return next;
      };
      const opts = { fetchFallback: () => Promise.resolve(), accumulate };
      subscribeSSE("http://test/acc", opts, () => {});
      const es = MockEventSource.instances[0];

      es.dispatchMessage({ id: 1, score: 5 });
      await vi.advanceTimersByTimeAsync(1000);
      es.dispatchMessage({ id: 2, score: 7 });
      await vi.advanceTimersByTimeAsync(1000);

      const lateSnapshots = [];
      subscribeSSE("http://test/acc", opts, (s) => lateSnapshots.push(s));

      const replayed = lateSnapshots[0].data;
      expect(replayed).toBeInstanceOf(Map);
      expect(replayed.size).toBe(2);
      expect(replayed.get(1)).toEqual({ id: 1, score: 5 });
      expect(replayed.get(2)).toEqual({ id: 2, score: 7 });
      vi.useRealTimers();
    });

    it("runs polling-fallback results through accumulate too", async () => {
      vi.useFakeTimers();
      const accumulate = (prev, patch) => {
        const next = new Map(prev ?? []);
        // Polling returns a Map, so iterate and merge.
        if (patch instanceof Map) {
          for (const [k, v] of patch) next.set(k, { ...next.get(k), ...v });
        } else {
          next.set(patch.id, { ...next.get(patch.id), ...patch });
        }
        return next;
      };
      const fallbackMap = new Map([[1, { id: 1, score: 11 }]]);
      const fetchFallback = vi.fn().mockResolvedValue(fallbackMap);

      const snapshots = [];
      subscribeSSE("http://test/acc", { fetchFallback, accumulate }, (s) =>
        snapshots.push(s),
      );
      const es = MockEventSource.instances[0];
      es.dispatchError();
      es.dispatchError();
      es.dispatchError();

      await vi.advanceTimersByTimeAsync(30_000);
      await Promise.resolve();

      const last = snapshots.at(-1).data;
      expect(last).toBeInstanceOf(Map);
      expect(last.get(1)).toEqual({ id: 1, score: 11 });
      vi.useRealTimers();
    });

    it("aggregates in-window messages without losing intermediate partials", async () => {
      vi.useFakeTimers();
      const accumulate = (prev, patch) => {
        const next = new Map(prev ?? []);
        next.set(patch.id, { ...next.get(patch.id), ...patch });
        return next;
      };
      const snapshots = [];
      subscribeSSE(
        "http://test/window",
        { fetchFallback: () => Promise.resolve(), accumulate },
        (s) => snapshots.push(s),
      );
      const es = MockEventSource.instances[0];

      // Three messages within the same throttle window (no timer advance between).
      es.dispatchMessage({ id: 1, score: 5 });
      es.dispatchMessage({ id: 2, score: 7 });
      es.dispatchMessage({ id: 1, score: 9 });

      // Drain the throttle.
      await vi.advanceTimersByTimeAsync(1000);

      const last = snapshots.at(-1).data;
      expect(last).toBeInstanceOf(Map);
      expect(last.size).toBe(2);
      expect(last.get(1)).toEqual({ id: 1, score: 9 });
      expect(last.get(2)).toEqual({ id: 2, score: 7 });
      vi.useRealTimers();
    });

    it("falls back to raw payload when no accumulate option provided (existing behavior)", async () => {
      vi.useFakeTimers();
      const snapshots = [];
      subscribeSSE("http://test/raw", { fetchFallback: () => Promise.resolve() }, (s) =>
        snapshots.push(s),
      );
      MockEventSource.instances[0].dispatchMessage([{ id: 1 }]);
      await vi.advanceTimersByTimeAsync(1000);

      expect(snapshots.find((s) => s.data !== undefined).data).toEqual([{ id: 1 }]);
      vi.useRealTimers();
    });
  });
});
