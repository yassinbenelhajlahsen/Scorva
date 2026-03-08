import { getPlayersByLeague } from "../services/playersService.js";

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function getPlayers(req, res) {
  const league = String(req.params.league || "").toLowerCase();
  if (!VALID_LEAGUES.includes(league)) return res.status(400).json({ error: "Invalid league" });

  try {
    const players = await getPlayersByLeague(league);
    res.json(players);
  } catch (err) {
    console.error("Error fetching players:", err);
    res.status(500).send("Server error");
  }
}
