import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mockPool = createMockPool();

const dbPath = resolve(__dirname, "../../src/db/db.js");
jest.unstable_mockModule(dbPath, () => ({ default: mockPool }));

const servicePath = resolve(__dirname, "../../src/services/chatHistoryService.js");
const {
  getOrCreateConversation,
  getConversationMessages,
  saveMessage,
  getConversationSummary,
  getConversationSummaryWithMeta,
  getMessageCount,
  getMessagesForSummarization,
  updateConversationSummary,
} = await import(servicePath);

describe("chatHistoryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrCreateConversation", () => {
    it("returns existing conversationId when found for user", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: "conv-1" }] });

      const result = await getOrCreateConversation("user-1", "conv-1");

      expect(result).toBe("conv-1");
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it("creates new conversation when conversationId is null", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: "conv-new" }] });

      const result = await getOrCreateConversation("user-1", null);

      expect(result).toBe("conv-new");
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO chat_conversations"),
        ["user-1"]
      );
    });

    it("creates new conversation when conversationId not found for user", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "conv-new" }] });

      const result = await getOrCreateConversation("user-1", "stale-conv");

      expect(result).toBe("conv-new");
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe("getConversationMessages", () => {
    it("returns messages in chronological order (reversed from DESC)", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { role: "assistant", content: "Hi!" },
          { role: "user", content: "Hello" },
        ],
      });

      const result = await getConversationMessages("conv-1");

      expect(result).toEqual([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
      ]);
    });

    it("passes limit parameter to query", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getConversationMessages("conv-1", 5);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["conv-1", 5]);
    });

    it("defaults limit to 20", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getConversationMessages("conv-1");

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["conv-1", 10]);
    });

    it("returns empty array when no messages found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getConversationMessages("conv-1");

      expect(result).toEqual([]);
    });
  });

  describe("saveMessage", () => {
    it("inserts message and bumps conversation updated_at", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await saveMessage("conv-1", "user", "Hello", null);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO chat_messages"),
        ["conv-1", "user", "Hello", null]
      );
      expect(mockPool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("UPDATE chat_conversations"),
        ["conv-1"]
      );
    });

    it("stringifies pageContext when provided", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const ctx = { type: "player", league: "nba" };
      await saveMessage("conv-1", "user", "Hello", ctx);

      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        ["conv-1", "user", "Hello", JSON.stringify(ctx)]
      );
    });

    it("passes null for pageContext when not provided", async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await saveMessage("conv-1", "assistant", "Answer");

      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        ["conv-1", "assistant", "Answer", null]
      );
    });
  });

  describe("getConversationSummary", () => {
    it("returns summary string when conversation has a summary", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ summary: "User asked about LeBron stats." }],
      });

      const result = await getConversationSummary("conv-1");

      expect(result).toBe("User asked about LeBron stats.");
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["conv-1"]);
    });

    it("returns null when conversation has no summary", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ summary: null }] });

      const result = await getConversationSummary("conv-1");

      expect(result).toBeNull();
    });

    it("returns null when conversation not found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getConversationSummary("missing-conv");

      expect(result).toBeNull();
    });
  });

  describe("getConversationSummaryWithMeta", () => {
    it("returns summary and summarized_up_to when row exists", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ summary: "Prior context.", summarized_up_to: 10 }],
      });

      const result = await getConversationSummaryWithMeta("conv-1");

      expect(result).toEqual({ summary: "Prior context.", summarized_up_to: 10 });
    });

    it("returns defaults when conversation not found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getConversationSummaryWithMeta("missing-conv");

      expect(result).toEqual({ summary: null, summarized_up_to: 0 });
    });
  });

  describe("getMessageCount", () => {
    it("returns integer count of messages in a conversation", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 25 }] });

      const result = await getMessageCount("conv-1");

      expect(result).toBe(25);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("COUNT(*)"),
        ["conv-1"]
      );
    });

    it("returns 0 when no messages exist", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ count: 0 }] });

      const result = await getMessageCount("conv-1");

      expect(result).toBe(0);
    });
  });

  describe("getMessagesForSummarization", () => {
    it("returns messages with correct OFFSET and LIMIT params", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there" },
        ],
      });

      const result = await getMessagesForSummarization("conv-1", 0, 10);

      expect(result).toEqual([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["conv-1", 0, 10]);
    });

    it("orders messages ASC by created_at", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await getMessagesForSummarization("conv-1", 5, 10);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY created_at ASC"),
        expect.any(Array)
      );
    });
  });

  describe("updateConversationSummary", () => {
    it("updates summary, summarized_up_to and updated_at on the conversation", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await updateConversationSummary("conv-1", "New summary text.", 20);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE chat_conversations"),
        ["New summary text.", 20, "conv-1"]
      );
    });

    it("includes updated_at = NOW() in the update", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await updateConversationSummary("conv-1", "Summary.", 10);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("updated_at = NOW()"),
        expect.any(Array)
      );
    });
  });
});
