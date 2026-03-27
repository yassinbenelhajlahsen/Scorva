import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Mocks ---

const mockRunAgentLoop = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/chatAgentService.js"),
  () => ({ runAgentLoop: mockRunAgentLoop })
);

const mockGetOrCreateConversation = jest.fn();
const mockGetConversationMessages = jest.fn();
const mockSaveMessage = jest.fn();
jest.unstable_mockModule(
  resolve(__dirname, "../../src/services/chatHistoryService.js"),
  () => ({
    getOrCreateConversation: mockGetOrCreateConversation,
    getConversationMessages: mockGetConversationMessages,
    saveMessage: mockSaveMessage,
  })
);

jest.unstable_mockModule(resolve(__dirname, "../../src/logger.js"), () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const controllerPath = resolve(__dirname, "../../src/controllers/chatController.js");
const { streamChat } = await import(controllerPath);

// --- Helpers ---

function makeReq(body = {}, user = { id: "user-1" }) {
  return { body, user };
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
  });
});
