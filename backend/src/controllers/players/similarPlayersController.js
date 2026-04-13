import { getPlayerIdBySlug } from "../../utils/slugResolver.js";
import { getCurrentSeason } from "../../cache/seasons.js";
import { getSimilarPlayers } from "../../services/players/similarPlayersService.js";

export async function getSimilar(req, res) {
  const league = req.params.league?.toLowerCase();
  const { slug } = req.params;

  const validLeagues = ["nba", "nfl", "nhl"];
  if (!validLeagues.includes(league)) {
    return res.status(400).json({ error: "Invalid league" });
  }

  const season = req.query.season || (await getCurrentSeason(league));
  const playerId = await getPlayerIdBySlug(slug, league);
  if (!playerId) return res.status(404).json({ error: "Player not found" });

  try {
    const players = await getSimilarPlayers(playerId, league, season);
    return res.json({ players });
  } catch (err) {
    req.log.error({ err, league, slug }, "similar players fetch error");
    return res.status(500).json({ error: "Failed to fetch similar players" });
  }
}
