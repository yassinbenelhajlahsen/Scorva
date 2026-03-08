import { getSeasons } from "../services/seasonsService.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getSeasonsList(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });

  try {
    const seasons = await getSeasons(league);
    res.json(seasons);
  } catch (err) {
    console.error("Error fetching seasons:", err);
    res.status(500).json({ error: "Failed to fetch seasons" });
  }
}
