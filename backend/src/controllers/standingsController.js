import { getStandings } from "../services/standingsService.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getStandingsList(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });
  const { season } = req.query;

  try {
    const standings = await getStandings(league, season);
    res.json(standings);
  } catch (err) {
    console.error("❌ Error fetching standings:", err);
    res.status(500).send("Failed to fetch standings");
  }
}
