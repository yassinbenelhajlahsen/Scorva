import { getLiveGamePartial } from "../../services/games/gamesService.js";
import { getNbaGame, getNflGame, getNhlGame } from "../../services/games/gameDetailService.js";
import { subscribe, unsubscribe } from "../../db/notificationBus.js";
import logger from "../../logger.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];
const HEARTBEAT_INTERVAL_MS = 15_000;

const leagueHandlers = {
  nba: getNbaGame,
  nfl: getNflGame,
  nhl: getNhlGame,
};

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
  const lcLeague = league?.toLowerCase();
  if (!VALID_LEAGUES.includes(lcLeague)) {
    return res.status(400).json({ error: "Invalid league" });
  }

  setSSEHeaders(res);

  let heartbeat;

  async function onNotification(msg) {
    if (res.writableEnded) return;
    const eventid = msg?.payload;
    if (!eventid) return;
    try {
      const partial = await getLiveGamePartial(lcLeague, eventid);
      if (res.writableEnded) return;
      if (!partial) return; // wrong league / unknown eventid
      res.write(`data: ${JSON.stringify(partial)}\n\n`);
    } catch (err) {
      logger.error({ err }, "SSE streamGames notification error");
      cleanup();
      if (!res.writableEnded) res.end();
    }
  }

  async function cleanup() {
    clearInterval(heartbeat);
    await unsubscribe(onNotification);
  }

  await subscribe(onNotification);

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

  if (Number.isNaN(parseInt(gameId, 10))) {
    return res.status(400).json({ error: "Invalid game ID" });
  }

  const handler = leagueHandlers[league.toLowerCase()];
  setSSEHeaders(res);

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
      logger.error({ err }, "SSE streamGame error");
      cleanup();
      if (!res.writableEnded) res.end();
    }
  }

  async function cleanup() {
    clearInterval(heartbeat);
    await unsubscribe(send);
  }

  await subscribe(send);

  await send();
  if (res.writableEnded) { await cleanup(); return; }

  heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  req.on("close", cleanup);
}
