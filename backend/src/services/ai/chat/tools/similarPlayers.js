import { getSimilarPlayers } from "../../../players/similarPlayersService.js";
import { getCurrentSeason } from "../../../../cache/seasons.js";

export async function similarPlayersTool({ league, playerId, season, limit = 5 }) {
  if (!league || !playerId) return { error: "league and playerId required" };
  const useSeason = season || (await getCurrentSeason(league));
  const results = await getSimilarPlayers(playerId, league, useSeason, Math.min(limit, 10));
  return { league, playerId, season: useSeason, similar: results };
}
