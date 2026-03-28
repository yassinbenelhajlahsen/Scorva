import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.stubEnv("VITE_API_URL", "http://localhost:3001");

const { streamChatMessage } = await import("../../api/chat.js");

// Helper: builds a mock ReadableStream from SSE event objects
function mockSSEResponse(...events) {
  const text = events
    .map((e) => `data: ${JSON.stringify(e)}\n\n`)
    .join("");
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: vi
          .fn()
          .mockImplementationOnce(async () => ({
            done: false,
            value: encoder.encode(text),
          }))
          .mockImplementationOnce(async () => ({ done: true, value: undefined })),
      }),
    },
  };
}

function mockErrorResponse(status, body = {}) {
  return {
    ok: false,
    status,
    json: async () => body,
  };
}

describe("streamChatMessage", () => {
  let mockFetch;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends POST to /api/chat with correct headers and body", async () => {
    mockFetch.mockResolvedValueOnce(mockSSEResponse({ type: "done", conversationId: "c1" }));

    const onDone = vi.fn();
    streamChatMessage({
      message: "Hello",
      conversationId: "conv-1",
      pageContext: { type: "league", league: "nba" },
      token: "tok123",
      onDelta: vi.fn(),
      onDone,
      onError: vi.fn(),
    });

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer tok123",
        }),
        body: JSON.stringify({
          message: "Hello",
          conversationId: "conv-1",
          pageContext: { type: "league", league: "nba" },
        }),
      })
    );
  });

  it("calls onDelta for each delta event", async () => {
    mockFetch.mockResolvedValueOnce(
      mockSSEResponse(
        { type: "delta", content: "Hello " },
        { type: "delta", content: "world!" },
        { type: "done", conversationId: "c1" }
      )
    );

    const onDelta = vi.fn();
    const onDone = vi.fn();
    streamChatMessage({ message: "Hi", token: "t", onDelta, onDone, onError: vi.fn() });

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(onDelta).toHaveBeenCalledTimes(2);
    expect(onDelta).toHaveBeenNthCalledWith(1, "Hello ");
    expect(onDelta).toHaveBeenNthCalledWith(2, "world!");
  });

  it("calls onDone with conversationId for done events", async () => {
    mockFetch.mockResolvedValueOnce(
      mockSSEResponse({ type: "done", conversationId: "conv-abc" })
    );

    const onDone = vi.fn();
    streamChatMessage({ message: "Hi", token: "t", onDelta: vi.fn(), onDone, onError: vi.fn() });

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(onDone).toHaveBeenCalledWith("conv-abc");
  });

  it("calls onError for error events in the stream", async () => {
    mockFetch.mockResolvedValueOnce(
      mockSSEResponse({ type: "error", message: "Something went wrong." })
    );

    const onError = vi.fn();
    streamChatMessage({ message: "Hi", token: "t", onDelta: vi.fn(), onDone: vi.fn(), onError });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledWith("Something went wrong.");
  });

  it("calls onError with server error message on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(500, { error: "Internal Server Error" }));

    const onError = vi.fn();
    streamChatMessage({ message: "Hi", token: "t", onDelta: vi.fn(), onDone: vi.fn(), onError });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledWith("Internal Server Error");
  });

  it("calls onError with fallback message on non-OK without error field", async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(503, {}));

    const onError = vi.fn();
    streamChatMessage({ message: "Hi", token: "t", onDelta: vi.fn(), onDone: vi.fn(), onError });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledWith("Request failed (503)");
  });

  it("calls onError on network failure (TypeError)", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const onError = vi.fn();
    streamChatMessage({ message: "Hi", token: "t", onDelta: vi.fn(), onDone: vi.fn(), onError });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError).toHaveBeenCalledWith("Connection lost. Please try again.");
  });

  it("does not call onError on AbortError", async () => {
    const abortErr = new DOMException("Aborted", "AbortError");
    mockFetch.mockRejectedValueOnce(abortErr);

    const onError = vi.fn();
    streamChatMessage({ message: "Hi", token: "t", onDelta: vi.fn(), onDone: vi.fn(), onError });

    // Wait a tick
    await new Promise((r) => setTimeout(r, 10));

    expect(onError).not.toHaveBeenCalled();
  });

  it("silently skips malformed SSE lines", async () => {
    const encoder = new TextEncoder();
    const text = "data: {invalid json\n\ndata: {\"type\":\"done\",\"conversationId\":\"c1\"}\n\n";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({ done: false, value: encoder.encode(text) })
            .mockResolvedValueOnce({ done: true }),
        }),
      },
    });

    const onDone = vi.fn();
    const onError = vi.fn();
    streamChatMessage({ message: "Hi", token: "t", onDelta: vi.fn(), onDone, onError });

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(onError).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith("c1");
  });

  it("ignores SSE lines without 'data: ' prefix", async () => {
    const encoder = new TextEncoder();
    const text = ": keepalive\n\ndata: {\"type\":\"done\",\"conversationId\":\"c2\"}\n\n";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({ done: false, value: encoder.encode(text) })
            .mockResolvedValueOnce({ done: true }),
        }),
      },
    });

    const onDone = vi.fn();
    streamChatMessage({ message: "Hi", token: "t", onDelta: vi.fn(), onDone, onError: vi.fn() });

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(onDone).toHaveBeenCalledWith("c2");
  });

  it("calls onStatus when a status SSE event is received", async () => {
    mockFetch.mockResolvedValueOnce(
      mockSSEResponse(
        { type: "status", content: "Checking standings" },
        { type: "done", conversationId: "c1" }
      )
    );

    const onStatus = vi.fn();
    const onDone = vi.fn();
    streamChatMessage({ message: "Hi", token: "t", onDelta: vi.fn(), onDone, onError: vi.fn(), onStatus });

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(onStatus).toHaveBeenCalledWith("Checking standings");
  });

  it("does not throw when onStatus is not provided (status event is silently ignored)", async () => {
    mockFetch.mockResolvedValueOnce(
      mockSSEResponse(
        { type: "status", content: "Checking standings" },
        { type: "done", conversationId: "c1" }
      )
    );

    const onDone = vi.fn();
    // No onStatus passed — should not throw
    streamChatMessage({ message: "Hi", token: "t", onDelta: vi.fn(), onDone, onError: vi.fn() });

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    // If we got here without throwing, the test passes
    expect(onDone).toHaveBeenCalledWith("c1");
  });

  it("passes signal to fetch for abort support", () => {
    const controller = new AbortController();
    mockFetch.mockResolvedValueOnce(mockSSEResponse({ type: "done", conversationId: "c1" }));

    streamChatMessage({
      message: "Hi",
      token: "t",
      signal: controller.signal,
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal })
    );
  });
});
