import { getStandings } from "../services/standingsService.js";

export async function getStandingsList(req, res) {
  const { league } = req.params;
  const { season } = req.query;

  try {
    const standings = await getStandings(league, season);
    res.json(standings);
  } catch (err) {
    console.error("❌ Error fetching standings:", err);
    res.status(500).send("Failed to fetch standings");
  }
}
