import { getNbaPlayer, getNflPlayer, getNhlPlayer } from "../../../players/playerDetailService.js";
import { getPlayerCareer } from "./playerCareer.js";
import { getPlayerGameLog } from "./playerGameLog.js";

const detailHandlers = {
  nba: getNbaPlayer,
  nfl: getNflPlayer,
  nhl: getNhlPlayer,
};

// Unified player tool. `include` controls which sections are fetched:
//   "detail"   → profile + season averages + recent games (default)
//   "game_log" → full per-game log across season(s) with optional minStat filter
//   "career"   → per-season summary + career-best games
//
// If include is omitted, returns just "detail" (matches old get_player_detail behavior).
export async function getPlayerUnified(args) {
  const {
    league,
    playerId,
    season,
    seasonStart,
    seasonEnd,
    minStat,
    minValue,
    gameLogLimit,
  } = args;
  if (!league || !playerId) return { error: "league and playerId required" };

  const handler = detailHandlers[league];
  if (!handler) return { error: `Invalid league: ${league}` };

  const includeRaw = Array.isArray(args.include) ? args.include : ["detail"];
  const include = new Set(includeRaw.length > 0 ? includeRaw : ["detail"]);

  const tasks = [];
  if (include.has("detail")) {
    tasks.push(handler(playerId, season).then((d) => ["detail", d]));
  }
  if (include.has("game_log")) {
    tasks.push(
      getPlayerGameLog({
        league,
        playerId,
        season,
        seasonStart,
        seasonEnd,
        minStat,
        minValue,
        limit: gameLogLimit,
      }).then((d) => ["game_log", d]),
    );
  }
  if (include.has("career")) {
    tasks.push(getPlayerCareer({ league, playerId }).then((d) => ["career", d]));
  }

  const results = await Promise.all(tasks);
  const out = { league, playerId };
  for (const [key, value] of results) out[key] = value;
  return out;
}
