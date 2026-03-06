import { getTeamsByLeague } from "../services/teamsService.js";

export async function getTeams(req, res) {
  const { league } = req.params;

  try {
    const teams = await getTeamsByLeague(league);
    res.json(teams);
  } catch (err) {
    console.error("Error fetching teams:", err);
    res.status(500).send("Server error");
  }
}
