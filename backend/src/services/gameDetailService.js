import pool from "../db/db.js";
import { cached } from "../cache/cache.js";
import { buildGameDetailSQL } from "./gameDetailQueryBuilder.js";

const GAME_DETAIL_TTL = 30 * 86400; // 30 days

async function getGameDetail(gameId, league) {
  return cached(
    `gameDetail:${league}:${gameId}`,
    GAME_DETAIL_TTL,
    async () => {
      const result = await pool.query(buildGameDetailSQL(league), [gameId, league]);
      return result.rows[0] ?? null;
    },
    { cacheIf: (data) => data?.json_build_object?.game?.status?.includes("Final") }
  );
}

export const getNbaGame = (gameId) => getGameDetail(gameId, "nba");
export const getNflGame = (gameId) => getGameDetail(gameId, "nfl");
export const getNhlGame = (gameId) => getGameDetail(gameId, "nhl");
