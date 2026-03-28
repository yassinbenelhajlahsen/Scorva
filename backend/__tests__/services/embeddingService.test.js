import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createMockPool } from "../helpers/testHelpers.js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Mocks ---

const mockEmbeddingsCreate = jest.fn();

jest.unstable_mockModule("openai", () => ({
  default: jest.fn().mockImplementation(() => ({
    embeddings: { create: mockEmbeddingsCreate },
  })),
}));

const mockPool = createMockPool();
jest.unstable_mockModule(resolve(__dirname, "../../src/db/db.js"), () => ({
  default: mockPool,
}));

jest.unstable_mockModule(resolve(__dirname, "../../src/logger.js"), () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const servicePath = resolve(__dirname, "../../src/services/embeddingService.js");
const { generateEmbedding, embedGameSummary, searchEmbeddings } = await import(servicePath);

const FAKE_EMBEDDING = Array.from({ length: 1536 }, (_, i) => i / 1536);

describe("embeddingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: FAKE_EMBEDDING }] });
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  describe("generateEmbedding", () => {
    it("calls OpenAI with text-embedding-3-small model", async () => {
      await generateEmbedding("test query");

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: "text-embedding-3-small",
        input: "test query",
      });
    });

    it("returns the embedding array from the response", async () => {
      const result = await generateEmbedding("test");

      expect(result).toEqual(FAKE_EMBEDDING);
    });
  });

  describe("embedGameSummary", () => {
    const mockGame = {
      league: "nba",
      date: "2026-03-01",
      homescore: 112,
      awayscore: 98,
      ai_summary: "The Celtics dominated from the opening tip.",
      home_name: "Boston Celtics",
      away_name: "Miami Heat",
    };

    it("queries the DB for game + teams join", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockGame] });
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // upsert

      await embedGameSummary(1);

      expect(mockPool.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("FROM games g"),
        [1]
      );
      expect(mockPool.query.mock.calls[0][1]).toEqual([1]);
    });

    it("generates embedding with content that includes league, teams, and summary", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockGame] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await embedGameSummary(1);

      const input = mockEmbeddingsCreate.mock.calls[0][0].input;
      expect(input).toContain("[NBA]");
      expect(input).toContain("Miami Heat");
      expect(input).toContain("Boston Celtics");
      expect(input).toContain("The Celtics dominated from the opening tip.");
    });

    it("upserts embedding into game_embeddings with vector format", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [mockGame] });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await embedGameSummary(1);

      const [sql, params] = mockPool.query.mock.calls[1];
      expect(sql).toContain("INSERT INTO game_embeddings");
      expect(sql).toContain("ON CONFLICT (game_id) DO UPDATE");
      expect(params[0]).toBe(1); // game_id
      expect(typeof params[1]).toBe("string"); // content
      // pgvector format: '[0.1,0.2,...]'
      expect(params[2]).toMatch(/^\[[\d.,\-e]+\]$/);
    });

    it("does nothing when game has no ai_summary (empty rows)", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await embedGameSummary(999);

      expect(mockEmbeddingsCreate).not.toHaveBeenCalled();
      expect(mockPool.query).toHaveBeenCalledTimes(1); // only the SELECT
    });

    it("catches errors silently (fire-and-forget contract)", async () => {
      mockPool.query.mockRejectedValueOnce(new Error("DB error"));

      // Should not throw
      await expect(embedGameSummary(1)).resolves.toBeUndefined();
    });
  });

  describe("searchEmbeddings", () => {
    it("generates embedding for the query text", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await searchEmbeddings("overtime thrillers", 5);

      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: "text-embedding-3-small",
        input: "overtime thrillers",
      });
    });

    it("queries game_embeddings with cosine similarity ordering", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await searchEmbeddings("overtime thrillers", 5);

      const [sql, params] = mockPool.query.mock.calls[0];
      expect(sql).toContain("game_embeddings");
      expect(sql).toContain("<=>");
      expect(params[1]).toBe(5); // limit
    });

    it("passes vector string in pgvector format to the query", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await searchEmbeddings("blowout wins", 3);

      const params = mockPool.query.mock.calls[0][1];
      // pgvector format: '[0.1,0.2,...]'
      expect(params[0]).toMatch(/^\[[\d.,\-e]+\]$/);
    });

    it("returns rows from the query result", async () => {
      const rows = [
        { game_id: 1, content: "[NBA] Celtics 112, Heat 98\nCeltics dominated.", similarity: 0.92 },
        { game_id: 2, content: "[NBA] Lakers 108, Warriors 99\nLakers won.", similarity: 0.85 },
      ];
      mockPool.query.mockResolvedValueOnce({ rows });

      const result = await searchEmbeddings("NBA wins", 5);

      expect(result).toEqual(rows);
    });

    it("returns empty array when no matches found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await searchEmbeddings("anything", 5);

      expect(result).toEqual([]);
    });
  });
});
