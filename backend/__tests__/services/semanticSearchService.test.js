import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Mocks ---

const mockSearchEmbeddings = jest.fn();
jest.unstable_mockModule(resolve(__dirname, "../../src/services/embeddingService.js"), () => ({
  searchEmbeddings: mockSearchEmbeddings,
}));

jest.unstable_mockModule(resolve(__dirname, "../../src/logger.js"), () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const servicePath = resolve(
  __dirname,
  "../../src/services/chatTools/semanticSearchService.js"
);
const { semanticSearch } = await import(servicePath);

describe("semanticSearchService — semanticSearch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls searchEmbeddings with the query and limit", async () => {
    mockSearchEmbeddings.mockResolvedValueOnce([]);

    await semanticSearch("overtime thrillers", 5);

    expect(mockSearchEmbeddings).toHaveBeenCalledWith("overtime thrillers", 5);
  });

  it("maps results to { gameId, summary, relevance } shape", async () => {
    mockSearchEmbeddings.mockResolvedValueOnce([
      { game_id: 42, content: "[NBA] Celtics 112, Heat 98\nGreat game.", similarity: 0.924567 },
      { game_id: 7, content: "[NFL] Chiefs 28, Bills 24\nOT thriller.", similarity: 0.811234 },
    ]);

    const result = await semanticSearch("overtime thrillers", 5);

    expect(result).toEqual({
      results: [
        { gameId: 42, summary: "[NBA] Celtics 112, Heat 98\nGreat game.", relevance: 0.92 },
        { gameId: 7, summary: "[NFL] Chiefs 28, Bills 24\nOT thriller.", relevance: 0.81 },
      ],
    });
  });

  it("rounds relevance to 2 decimal places", async () => {
    mockSearchEmbeddings.mockResolvedValueOnce([
      { game_id: 1, content: "content", similarity: 0.999999 },
    ]);

    const result = await semanticSearch("query", 5);

    expect(result.results[0].relevance).toBe(1);
  });

  it("returns empty results with message when no matches found", async () => {
    mockSearchEmbeddings.mockResolvedValueOnce([]);

    const result = await semanticSearch("very specific query", 5);

    expect(result).toEqual({
      results: [],
      message: "No matching game summaries found.",
    });
  });

  it("returns error object when searchEmbeddings throws", async () => {
    mockSearchEmbeddings.mockRejectedValueOnce(new Error("pgvector down"));

    const result = await semanticSearch("query", 5);

    expect(result).toEqual({ error: "Semantic search temporarily unavailable" });
  });
});
