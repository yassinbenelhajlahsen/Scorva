import {
  getReportsForLeague,
  getReportsAcrossLeagues,
} from "../../services/reports/reportsService.js";
import logger from "../../logger.js";

const VALID_LEAGUES = new Set(["nba", "nfl", "nhl"]);
const VALID_TYPES = new Set(["injury", "move", "birthday", "streak"]);
const MAX_LIMIT = 50;

function parseInt10(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function getReports(req, res) {
  const { league, type } = req.query;

  if (league !== undefined && !VALID_LEAGUES.has(league)) {
    return res.status(400).json({ error: "Invalid league." });
  }
  if (type !== undefined && !VALID_TYPES.has(type)) {
    return res.status(400).json({ error: "Invalid type." });
  }

  const limit = Math.min(Math.max(parseInt10(req.query.limit, 20), 1), MAX_LIMIT);
  const offset = Math.max(parseInt10(req.query.offset, 0), 0);

  try {
    const all = league
      ? await getReportsForLeague(league)
      : await getReportsAcrossLeagues();

    const filtered = type ? all.filter((r) => r.type === type) : all;
    const sliced = filtered.slice(offset, offset + limit);

    res.json({
      reports: sliced,
      total: filtered.length,
      hasMore: offset + sliced.length < filtered.length,
    });
  } catch (err) {
    logger.error({ err }, "reports fetch failed");
    res.status(500).json({ error: "Failed to fetch reports." });
  }
}
