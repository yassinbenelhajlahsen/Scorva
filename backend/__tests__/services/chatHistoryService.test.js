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
const { getOrCreateConversation, getConversationMessages, saveMessage } =
  await import(servicePath);

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

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ["conv-1", 20]);
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
});
