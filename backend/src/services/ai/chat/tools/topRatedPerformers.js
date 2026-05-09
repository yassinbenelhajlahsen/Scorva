import { getTopPerformances } from "../../../games/topPerformancesService.js";

const ALLOWED_WINDOWS = new Set(["today", "week", "month", "season", "all"]);
const ALLOWED_TYPES = new Set(["performances", "rankings"]);
const ALLOWED_POSITIONS = new Set(["all", "G", "F", "C"]);

export async function getTopRatedPerformers(args) {
  const league = args?.league;
  if (league !== "nba") {
    return {
      error:
        "Player ratings are NBA-only. This tool does not support NFL or NHL.",
    };
  }

  const type = ALLOWED_TYPES.has(args.type) ? args.type : "performances";
  const window = ALLOWED_WINDOWS.has(args.window) ? args.window : "week";
  const sort = args.sort === "asc" ? "asc" : "desc";
  const position = ALLOWED_POSITIONS.has(args.position) ? args.position : "all";
  const limit = args.limit;

  try {
    return await getTopPerformances({
      league,
      type,
      window,
      sort,
      position,
      limit,
    });
  } catch (err) {
    return { error: err?.message || "Failed to fetch top-rated performers." };
  }
}
