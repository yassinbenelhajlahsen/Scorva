import {
  getCachedSummary,
  getGameForSummary,
  getGameStats,
  saveSummary,
  buildGameData,
  generateAISummary,
} from "../services/aiSummaryService.js";
import logger from "../logger.js";

export async function getAiSummary(req, res) {
  const { id } = req.params;

  try {
    // Step 1: Check if summary already exists (CACHE CHECK)
    const cached = await getCachedSummary(id);

    if (cached.notFound) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (cached.summary) {
      return res.json({ summary: cached.summary, cached: true });
    }

    // Step 2: Fetch full game data
    const game = await getGameForSummary(id);

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    // Only generate summaries for completed games
    if (!game.status || !game.status.toLowerCase().includes("final")) {
      return res.json({
        summary: "AI summary unavailable for this game.",
        reason: "Game must be completed before summary can be generated",
        cached: false,
      });
    }

    // Step 3: Fetch player stats
    const stats = await getGameStats(id);

    // Step 4: Build structured game data for OpenAI
    const gameData = buildGameData(game, stats);

    // Step 5: Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      logger.error("OPENAI_API_KEY not configured");
      return res.json({
        summary: "AI summary unavailable for this game.",
        cached: false,
      });
    }

    // Step 6: Generate AI summary (ONLY HAPPENS ONCE)
    const summary = await generateAISummary(gameData, game.league);

    // Step 7: Store summary permanently in database
    await saveSummary(id, summary);

    // Step 8: Return generated summary
    return res.json({ summary, cached: false });
  } catch (error) {
    logger.error({ err: error }, "Error generating AI summary");
    return res.status(500).json({
      summary: "AI summary unavailable for this game.",
      cached: false,
    });
  }
}
