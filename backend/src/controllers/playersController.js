import { getPlayersByLeague } from "../services/playersService.js";

export async function getPlayers(req, res) {
  const { league } = req.params;

  try {
    const players = await getPlayersByLeague(league);
    res.json(players);
  } catch (err) {
    console.error("Error fetching players:", err);
    res.status(500).send("Server error");
  }
}
