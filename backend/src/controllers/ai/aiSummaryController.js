import {
  getCachedSummary,
  getGameForSummary,
  getGameStats,
  getClutchPlays,
  saveSummary,
  buildGameData,
  streamAISummary,
} from "../../services/ai/aiSummaryService.js";
import logger from "../../logger.js";

const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

function sendLine(res, obj) {
  res.write(JSON.stringify(obj) + "\n");
}

export async function getAiSummary(req, res) {
  const { id } = req.params;

  if (Number.isNaN(parseInt(id, 10))) {
    return res.status(400).json({ error: "Invalid game ID" });
  }

  try {
    // Step 1: Check DB cache
    const cached = await getCachedSummary(id);

    if (cached.notFound) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (cached.summary) {
      res.writeHead(200, NDJSON_HEADERS);
      sendLine(res, { type: "full", summary: cached.summary, cached: true });
      res.end();
      return;
    }

    // Step 2: Fetch game data
    const game = await getGameForSummary(id);

    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    // Only generate for completed games
    if (!game.status || !game.status.toLowerCase().includes("final")) {
      res.writeHead(200, NDJSON_HEADERS);
      sendLine(res, {
        type: "full",
        summary: "AI summary unavailable for this game.",
        cached: false,
      });
      res.end();
      return;
    }

    // Step 3: Validate API key
    if (!process.env.OPENAI_API_KEY) {
      logger.error("OPENAI_API_KEY not configured");
      res.writeHead(200, NDJSON_HEADERS);
      sendLine(res, {
        type: "full",
        summary: "AI summary unavailable for this game.",
        cached: false,
      });
      res.end();
      return;
    }

    // Step 4: Fetch stats and clutch plays, then build game data
    const [stats, clutchPlays] = await Promise.all([
      getGameStats(id),
      getClutchPlays(id, game.league),
    ]);
    const gameData = buildGameData(game, stats, clutchPlays);

    // Step 5: Stream generation
    res.writeHead(200, NDJSON_HEADERS);

    const abort = new AbortController();
    req.on("close", () => abort.abort());

    const bullets = [];

    await streamAISummary(gameData, game.league, (text) => {
      bullets.push(text);
      sendLine(res, { type: "bullet", text });
    }, { signal: abort.signal });

    if (!abort.signal.aborted) {
      sendLine(res, { type: "done" });
      const fullSummary = bullets.map((b) => `- ${b}`).join("\n");
      await saveSummary(id, fullSummary).catch((err) => {
        logger.error({ err }, "Failed to save AI summary");
      });
    }

    res.end();
  } catch (error) {
    logger.error({ err: error }, "Error generating AI summary");
    if (!res.headersSent) {
      return res.status(500).json({ summary: "AI summary unavailable for this game.", cached: false });
    }
    sendLine(res, {
      type: "error",
      message: "AI summary unavailable for this game.",
    });
    res.end();
  }
}
