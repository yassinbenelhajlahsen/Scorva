import { searchEmbeddings } from "../../embeddingService.js";
import logger from "../../../../logger.js";

/**
 * Semantic search tool for the chat agent.
 * Searches game summary embeddings using cosine similarity.
 */
export async function semanticSearch(query, limit = 5) {
  try {
    const results = await searchEmbeddings(query, limit);

    if (results.length === 0) {
      return { results: [], message: "No matching game summaries found." };
    }

    return {
      results: results.map((r) => ({
        gameId: r.game_id,
        summary: r.content,
        relevance: Math.round(r.similarity * 100) / 100,
      })),
    };
  } catch (err) {
    logger.error({ err }, "Semantic search failed");
    return { error: "Semantic search temporarily unavailable" };
  }
}
