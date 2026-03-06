import { getGames } from "../services/gamesService.js";

export async function getGamesList(req, res) {
  const { league } = req.params;
  const { teamId, season } = req.query;

  try {
    const games = await getGames(league, { teamId, season });
    res.json(games);
  } catch (err) {
    console.error("Error fetching games:", err);
    res.status(500).json({ error: "Failed to fetch games." });
  }
}
