import { getSeasons } from "../services/seasonsService.js";

export async function getSeasonsList(req, res) {
  const { league } = req.params;

  try {
    const seasons = await getSeasons(league);
    res.json(seasons);
  } catch (err) {
    console.error("Error fetching seasons:", err);
    res.status(500).json({ error: "Failed to fetch seasons" });
  }
}
