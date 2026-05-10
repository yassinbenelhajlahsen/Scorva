// Shared SSE client. One EventSource per URL across the app, refcounted by
// subscribers. Used by useLiveGames(league) and useLiveGame(league, gameId)
// so multiple components asking for the same live stream share a single
// underlying connection.

const MAX_FAILURES = 3;
const POLL_INTERVAL_MS = 30_000;
const THROTTLE_MS = 1000;

const clients = new Map();

function broadcast(state, patch) {
  state.lastSnapshot = { ...state.lastSnapshot, ...patch };
  for (const listener of state.listeners) listener(patch);
}

function openConnection(url, state) {
  const es = new EventSource(url);
  state.es = es;
  state.failureCount = 0;

  es.onmessage = (event) => {
    state.failureCount = 0;
    try {
      state.pendingPayload = JSON.parse(event.data);
      if (!state.throttleTimer) {
        state.throttleTimer = setTimeout(() => {
          if (state.pendingPayload !== null) {
            broadcast(state, { data: state.pendingPayload });
            state.pendingPayload = null;
          }
          state.throttleTimer = null;
        }, THROTTLE_MS);
      }
    } catch {
      // ignore parse errors
    }
  };

  es.addEventListener("done", () => {
    state.done = true;
    closeEs(state);
    broadcast(state, { isStreaming: false });
  });

  es.onerror = () => {
    state.failureCount += 1;
    if (state.failureCount >= MAX_FAILURES) {
      closeEs(state);
      startPollingFallback(state);
    }
  };
}

function closeEs(state) {
  if (state.es) {
    state.es.close();
    state.es = null;
  }
  if (state.throttleTimer) {
    clearTimeout(state.throttleTimer);
    state.throttleTimer = null;
  }
  state.pendingPayload = null;
}

function startPollingFallback(state) {
  broadcast(state, { streamError: true, isStreaming: false });
  state.pollTimer = setInterval(async () => {
    try {
      const data = await state.fetchFallback();
      broadcast(state, { data });
    } catch {
      // silently continue
    }
  }, POLL_INTERVAL_MS);
}

function teardown(url, state) {
  closeEs(state);
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  clients.delete(url);
}

export function subscribeSSE(url, { fetchFallback }, listener) {
  let state = clients.get(url);

  if (!state) {
    state = {
      es: null,
      listeners: new Set(),
      lastSnapshot: {},
      fetchFallback,
      failureCount: 0,
      pollTimer: null,
      throttleTimer: null,
      pendingPayload: null,
      done: false,
    };
    clients.set(url, state);
    state.listeners.add(listener);
    openConnection(url, state);
    broadcast(state, { isStreaming: true });
  } else {
    state.listeners.add(listener);
    // Replay cached snapshot synchronously so late subscribers don't see
    // initial-null flicker before the next SSE tick.
    if (Object.keys(state.lastSnapshot).length > 0) {
      listener(state.lastSnapshot);
    }
  }

  return function unsubscribe() {
    const current = clients.get(url);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      teardown(url, current);
    }
  };
}

export function forceReconnect(url) {
  const state = clients.get(url);
  if (!state || state.done) return;
  closeEs(state);
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  openConnection(url, state);
  broadcast(state, { isStreaming: true, streamError: false });
}

export function __resetForTests() {
  for (const [url, state] of clients) {
    closeEs(state);
    if (state.pollTimer) clearInterval(state.pollTimer);
    clients.delete(url);
  }
}
