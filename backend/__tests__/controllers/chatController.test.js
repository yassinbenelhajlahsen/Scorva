import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Mocks ---

const mockRunAgentLoop = jest.fn();
const mockSummarizeOlderMessages = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/ai/chat/agentService.js"),
  () => ({ runAgentLoop: mockRunAgentLoop, summarizeOlderMessages: mockSummarizeOlderMessages })
);

const mockGetOrCreateConversation = jest.fn();
const mockGetConversationMessages = jest.fn();
const mockSaveMessage = jest.fn();
const mockGetConversationSummary = jest.fn();
const mockGetConversationSummaryWithMeta = jest.fn();
const mockGetMessageCount = jest.fn();
const mockGetMessagesForSummarization = jest.fn();
const mockUpdateConversationSummary = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/ai/chat/historyService.js"),
  () => ({
    getOrCreateConversation: mockGetOrCreateConversation,
    getConversationMessages: mockGetConversationMessages,
    saveMessage: mockSaveMessage,
    getConversationSummary: mockGetConversationSummary,
    getConversationSummaryWithMeta: mockGetConversationSummaryWithMeta,
    getMessageCount: mockGetMessageCount,
    getMessagesForSummarization: mockGetMessagesForSummarization,
    updateConversationSummary: mockUpdateConversationSummary,
  })
);

jest.unstable_mockModule(resolve(__dirname, "../../src/logger.js"), () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const controllerPath = resolve(__dirname, "../../src/controllers/ai/chatController.js");
const { streamChat } = await import(controllerPath);

// --- Helpers ---

function makeReq(body = {}, user = { id: "user-1" }) {
  return { body, user, on: jest.fn() };
}

function makeRes() {
  const written = [];
  return {
    written,
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    writeHead: jest.fn(),
    write: jest.fn((data) => written.push(data)),
    end: jest.fn(),
  };
}

function parseSseEvent(data) {
  const line = data.replace(/^data: /, "");
  return JSON.parse(line);
}

describe("chatController — streamChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOrCreateConversation.mockResolvedValue("conv-1");
    mockGetConversationMessages.mockResolvedValue([]);
    mockSaveMessage.mockResolvedValue();
    mockGetConversationSummary.mockResolvedValue(null);
    mockGetConversationSummaryWithMeta.mockResolvedValue({ summary: null, summarized_up_to: 0 });
    mockGetMessageCount.mockResolvedValue(0);
    mockGetMessagesForSummarization.mockResolvedValue([]);
    mockUpdateConversationSummary.mockResolvedValue();
    mockSummarizeOlderMessages.mockResolvedValue("Summary.");
    mockRunAgentLoop.mockResolvedValue("The answer.");
  });

  describe("input validation", () => {
    it("returns 400 when message is missing", async () => {
      const req = makeReq({});
      const res = makeRes();

      await streamChat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Message is required" });
    });

    it("returns 400 when message is empty string", async () => {
      const req = makeReq({ message: "" });
      const res = makeRes();

      await streamChat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 when message is only whitespace", async () => {
      const req = makeReq({ message: "   " });
      const res = makeRes();

      await streamChat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 when message is not a string", async () => {
      const req = makeReq({ message: 123 });
      const res = makeRes();

      await streamChat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 400 when message exceeds 2000 characters", async () => {
      const req = makeReq({ message: "x".repeat(2001) });
      const res = makeRes();

      await streamChat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Message too long (max 2000 characters)" });
    });

    it("returns 400 when message is only control characters", async () => {
      const req = makeReq({ message: "\x00\x01\x02" });
      const res = makeRes();

      await streamChat(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("strips null bytes and passes clean message through", async () => {
      const req = makeReq({ message: "Hello\x00 world" });
      const res = makeRes();

      await streamChat(req, res);

      expect(mockSaveMessage).toHaveBeenCalledWith("conv-1", "user", "Hello world", null);
    });
  });

  describe("sanitizePageContext", () => {
    it("passes null context when pageContext is not an object", async () => {
      const req = makeReq({ message: "Hello", pageContext: "invalid" });
      const res = makeRes();

      await streamChat(req, res);

      expect(mockSaveMessage).toHaveBeenCalledWith("conv-1", "user", "Hello", null);
    });

    it("passes null context when pageContext is an array", async () => {
      const req = makeReq({ message: "Hello", pageContext: [] });
      const res = makeRes();

      await streamChat(req, res);

      expect(mockSaveMessage).toHaveBeenCalledWith("conv-1", "user", "Hello", null);
    });

    it("passes null context when type is not in allowlist", async () => {
      const req = makeReq({ message: "Hello", pageContext: { type: "admin" } });
      const res = makeRes();

      await streamChat(req, res);

      expect(mockSaveMessage).toHaveBeenCalledWith("conv-1", "user", "Hello", null);
    });

    it("validates league against allowlist", async () => {
      const req = makeReq({
        message: "Hello",
        pageContext: { type: "league", league: "mlb" },
      });
      const res = makeRes();

      await streamChat(req, res);

      const callArgs = mockSaveMessage.mock.calls[0];
      expect(callArgs[3].league).toBeNull();
    });

    it("accepts valid player context with valid slug", async () => {
      const ctx = { type: "player", league: "nba", playerSlug: "lebron-james" };
      const req = makeReq({ message: "Stats?", pageContext: ctx });
      const res = makeRes();

      await streamChat(req, res);

      const savedCtx = mockSaveMessage.mock.calls[0][3];
      expect(savedCtx.type).toBe("player");
      expect(savedCtx.league).toBe("nba");
      expect(savedCtx.playerSlug).toBe("lebron-james");
    });

    it("rejects slug with invalid characters", async () => {
      const req = makeReq({
        message: "Hello",
        pageContext: { type: "player", league: "nba", playerSlug: "LeBron James" },
      });
      const res = makeRes();

      await streamChat(req, res);

      const savedCtx = mockSaveMessage.mock.calls[0][3];
      expect(savedCtx.playerSlug).toBeNull();
    });

    it("accepts valid game context with integer gameId", async () => {
      const req = makeReq({
        message: "This game?",
        pageContext: { type: "game", gameId: 42 },
      });
      const res = makeRes();

      await streamChat(req, res);

      const savedCtx = mockSaveMessage.mock.calls[0][3];
      expect(savedCtx.gameId).toBe(42);
    });

    it("rejects non-integer gameId", async () => {
      const req = makeReq({
        message: "Hello",
        pageContext: { type: "game", gameId: "42abc" },
      });
      const res = makeRes();

      await streamChat(req, res);

      const savedCtx = mockSaveMessage.mock.calls[0][3];
      expect(savedCtx.gameId).toBeNull();
    });
  });

  describe("SSE streaming", () => {
    it("sets SSE headers correctly", async () => {
      const req = makeReq({ message: "Hello" });
      const res = makeRes();

      await streamChat(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        })
      );
    });

    it("creates/gets conversation and saves user message", async () => {
      const req = makeReq({ message: "Hello", conversationId: "existing-conv" });
      const res = makeRes();

      await streamChat(req, res);

      expect(mockGetOrCreateConversation).toHaveBeenCalledWith("user-1", "existing-conv");
      expect(mockSaveMessage).toHaveBeenCalledWith("conv-1", "user", "Hello", null);
    });

    it("passes null conversationId when not provided", async () => {
      const req = makeReq({ message: "Hello" });
      const res = makeRes();

      await streamChat(req, res);

      expect(mockGetOrCreateConversation).toHaveBeenCalledWith("user-1", null);
    });

    it("streams delta events from runAgentLoop via onDelta callback", async () => {
      mockRunAgentLoop.mockImplementation(async (_history, _ctx, onDelta) => {
        onDelta("Hello ");
        onDelta("world!");
        return "Hello world!";
      });

      const req = makeReq({ message: "Hi" });
      const res = makeRes();

      await streamChat(req, res);

      const deltaEvents = res.written.filter((w) => w.includes('"type":"delta"'));
      expect(deltaEvents).toHaveLength(2);
      expect(parseSseEvent(deltaEvents[0])).toEqual({ type: "delta", content: "Hello " });
      expect(parseSseEvent(deltaEvents[1])).toEqual({ type: "delta", content: "world!" });
    });

    it("saves assistant message and sends done event", async () => {
      const req = makeReq({ message: "Hi" });
      const res = makeRes();

      await streamChat(req, res);

      expect(mockSaveMessage).toHaveBeenCalledWith("conv-1", "assistant", "The answer.");
      const doneEvent = res.written.find((w) => w.includes('"type":"done"'));
      expect(parseSseEvent(doneEvent)).toEqual({ type: "done", conversationId: "conv-1" });
    });

    it("sends error SSE event when runAgentLoop throws", async () => {
      mockRunAgentLoop.mockRejectedValueOnce(new Error("OpenAI down"));

      const req = makeReq({ message: "Hi" });
      const res = makeRes();

      await streamChat(req, res);

      const errorEvent = res.written.find((w) => w.includes('"type":"error"'));
      expect(errorEvent).toBeDefined();
      expect(parseSseEvent(errorEvent)).toMatchObject({ type: "error" });
    });

    it("calls res.end() in finally block even on error", async () => {
      mockRunAgentLoop.mockRejectedValueOnce(new Error("crash"));

      const req = makeReq({ message: "Hi" });
      const res = makeRes();

      await streamChat(req, res);

      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it("calls res.end() on successful completion", async () => {
      const req = makeReq({ message: "Hi" });
      const res = makeRes();

      await streamChat(req, res);

      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it("emits SSE status event when onStatus is called by runAgentLoop", async () => {
      mockRunAgentLoop.mockImplementation(async (_history, _ctx, _onDelta, { onStatus } = {}) => {
        onStatus("Checking standings");
        return "Done.";
      });

      const req = makeReq({ message: "Who leads?" });
      const res = makeRes();

      await streamChat(req, res);

      const statusEvent = res.written.find((w) => w.includes('"type":"status"'));
      expect(statusEvent).toBeDefined();
      expect(parseSseEvent(statusEvent)).toEqual({ type: "status", content: "Checking standings" });
    });

    it("fetches conversation summary and passes it to runAgentLoop", async () => {
      mockGetConversationSummary.mockResolvedValueOnce("User was asking about LeBron.");

      const req = makeReq({ message: "More about LeBron?" });
      const res = makeRes();

      await streamChat(req, res);

      const callOptions = mockRunAgentLoop.mock.calls[0][3];
      expect(callOptions.conversationSummary).toBe("User was asking about LeBron.");
    });

    it("passes null conversationSummary to runAgentLoop when no summary exists", async () => {
      mockGetConversationSummary.mockResolvedValueOnce(null);

      const req = makeReq({ message: "Hi" });
      const res = makeRes();

      await streamChat(req, res);

      const callOptions = mockRunAgentLoop.mock.calls[0][3];
      expect(callOptions.conversationSummary).toBeNull();
    });

    it("calls triggerSummarization fire-and-forget after saving assistant message", async () => {
      // Set up enough messages to trigger summarization (totalCount > 20)
      mockGetMessageCount.mockResolvedValue(25);
      mockGetConversationSummaryWithMeta.mockResolvedValue({ summary: null, summarized_up_to: 0 });
      mockGetMessagesForSummarization.mockResolvedValue([
        { role: "user", content: "Old question" },
        { role: "assistant", content: "Old answer" },
      ]);

      const req = makeReq({ message: "Hi" });
      const res = makeRes();

      await streamChat(req, res);

      // Allow microtasks/promises to flush so the fire-and-forget chain runs
      await new Promise((r) => setTimeout(r, 0));

      expect(mockGetMessageCount).toHaveBeenCalledWith("conv-1", "user-1");
      expect(mockSummarizeOlderMessages).toHaveBeenCalled();
      expect(mockUpdateConversationSummary).toHaveBeenCalledWith("conv-1", "user-1", "Summary.", 5);
    });

    it("does not throw when triggerSummarization fails (fire-and-forget)", async () => {
      mockGetMessageCount.mockRejectedValueOnce(new Error("DB error"));

      const req = makeReq({ message: "Hi" });
      const res = makeRes();

      // Should not throw even though triggerSummarization rejects
      await expect(streamChat(req, res)).resolves.toBeUndefined();
    });
  });
});
