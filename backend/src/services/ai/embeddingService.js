import OpenAI from "openai";
import pool from "../../db/db.js";
import logger from "../../logger.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dimensions

/**
 * Generate an embedding vector for a text string.
 */
export async function generateEmbedding(text) {
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

/**
 * Build a rich text chunk for a game summary that includes metadata for context.
 * Format: "[LEAGUE] Away Team Score, Home Team Score (Date)\nSummary text"
 */
function buildEmbeddingContent(game, summary) {
  const date = game.date
    ? new Date(game.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown date";
  return `[${game.league.toUpperCase()}] ${game.away_name} ${game.awayscore ?? "?"}, ${game.home_name} ${game.homescore ?? "?"} (${date})\n${summary}`;
}

/**
 * Generate and store an embedding for a game's AI summary.
 * Called after AI summary generation — fire-and-forget.
 */
export async function embedGameSummary(gameId) {
  try {
    const { rows } = await pool.query(
      `SELECT g.league, g.date, g.homescore, g.awayscore, g.ai_summary,
              ht.name AS home_name, at.name AS away_name
       FROM games g
       JOIN teams ht ON ht.id = g.hometeamid
       JOIN teams at ON at.id = g.awayteamid
       WHERE g.id = $1 AND g.ai_summary IS NOT NULL`,
      [gameId],
    );
    if (!rows[0]) return;

    const content = buildEmbeddingContent(rows[0], rows[0].ai_summary);
    const embedding = await generateEmbedding(content);

    // pgvector expects the vector as a string literal: '[0.1,0.2,...]'
    const vecStr = `[${embedding.join(",")}]`;
    await pool.query(
      `INSERT INTO game_embeddings (game_id, content, embedding)
       VALUES ($1, $2, $3::vector)
       ON CONFLICT (game_id) DO UPDATE
       SET content = EXCLUDED.content, embedding = EXCLUDED.embedding, created_at = NOW()`,
      [gameId, content, vecStr],
    );

    logger.info({ gameId }, "Game summary embedded");
  } catch (err) {
    logger.warn({ err, gameId }, "Failed to embed game summary");
  }
}

/**
 * Semantic search: find game summaries most similar to a query.
 * Returns top-k results with cosine similarity score.
 */
export async function searchEmbeddings(query, limit = 5) {
  const queryEmbedding = await generateEmbedding(query);
  const vecStr = `[${queryEmbedding.join(",")}]`;

  const { rows } = await pool.query(
    `SELECT ge.game_id, ge.content,
            1 - (ge.embedding <=> $1::vector) AS similarity
     FROM game_embeddings ge
     ORDER BY ge.embedding <=> $1::vector
     LIMIT $2`,
    [vecStr, limit],
  );

  return rows;
}
