import pool from "../db/db.js";
import { getGames } from "../services/gamesService.js";
import { getNbaGame, getNflGame, getNhlGame } from "../services/gameInfoService.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];
const HEARTBEAT_INTERVAL_MS = 15_000;

const leagueHandlers = {
  nba: getNbaGame,
  nfl: getNflGame,
  nhl: getNhlGame,
};

function isLiveStatus(status) {
  return (
    status.includes("In Progress") ||
    status.includes("End of Period") ||
    status.includes("Halftime")
  );
}

function setSSEHeaders(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 30000\n\n");
}

export async function streamGames(req, res) {
  const { league } = req.params;
  if (!VALID_LEAGUES.includes(league?.toLowerCase())) {
    return res.status(400).json({ error: "Invalid league" });
  }

  setSSEHeaders(res);

  let listenClient = null;
  let heartbeat;

  async function send() {
    if (res.writableEnded) return;
    try {
      const games = await getGames(league.toLowerCase(), { live: true });
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(games)}\n\n`);
      const anyLive = games.some((g) => isLiveStatus(g.status));
      if (!anyLive) {
        res.write("event: done\ndata: final\n\n");
        cleanup();
        res.end();
      }
    } catch (err) {
      console.error("SSE streamGames error:", err);
    }
  }

  async function cleanup() {
    clearInterval(heartbeat);
    const client = listenClient;
    listenClient = null;
    if (client) {
      try { await client.query("UNLISTEN game_updated"); } catch { /* ignore */ }
      client.release();
    }
  }

  try {
    listenClient = await pool.connect();
    await listenClient.query("LISTEN game_updated");
    listenClient.on("notification", send);
  } catch (err) {
    console.error("SSE LISTEN setup error:", err);
  }

  await send();
  if (res.writableEnded) { await cleanup(); return; }

  heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  req.on("close", cleanup);
}

export async function streamGame(req, res) {
  const { league, gameId } = req.params;
  if (!VALID_LEAGUES.includes(league?.toLowerCase())) {
    return res.status(400).json({ error: "Invalid league" });
  }

  const handler = leagueHandlers[league.toLowerCase()];
  setSSEHeaders(res);

  let listenClient = null;
  let heartbeat;

  async function send() {
    if (res.writableEnded) return;
    try {
      const game = await handler(gameId);
      if (res.writableEnded) return;
      if (!game) {
        res.write("event: done\ndata: final\n\n");
        cleanup();
        res.end();
        return;
      }
      res.write(`data: ${JSON.stringify(game)}\n\n`);
      const status = game.json_build_object?.game?.status ?? "";
      if (status.includes("Final")) {
        res.write("event: done\ndata: final\n\n");
        cleanup();
        res.end();
      }
    } catch (err) {
      console.error("SSE streamGame error:", err);
    }
  }

  async function cleanup() {
    clearInterval(heartbeat);
    const client = listenClient;
    listenClient = null;
    if (client) {
      try { await client.query("UNLISTEN game_updated"); } catch { /* ignore */ }
      client.release();
    }
  }

  try {
    listenClient = await pool.connect();
    await listenClient.query("LISTEN game_updated");
    listenClient.on("notification", send);
  } catch (err) {
    console.error("SSE LISTEN setup error:", err);
  }

  await send();
  if (res.writableEnded) { await cleanup(); return; }

  heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  req.on("close", cleanup);
}
