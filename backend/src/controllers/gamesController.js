import { getGames } from "../services/gamesService.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getGamesList(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });
  const { teamId, season } = req.query;

  try {
    const games = await getGames(league, { teamId, season });
    res.json(games);
  } catch (err) {
    console.error("Error fetching games:", err);
    res.status(500).json({ error: "Failed to fetch games." });
  }
}
