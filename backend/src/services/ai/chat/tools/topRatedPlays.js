import { getTopPerformances } from "../../../games/topPerformancesService.js";

const ALLOWED_WINDOWS = new Set(["today", "week", "month", "season", "all"]);
const ALLOWED_POSITIONS = new Set(["all", "G", "F", "C"]);

export async function getTopRatedPlays(args) {
  const league = args?.league;
  if (league !== "nba") {
    return {
      error:
        "Per-play ratings are NBA-only. This tool does not support NFL or NHL.",
    };
  }

  const window = ALLOWED_WINDOWS.has(args.window) ? args.window : "week";
  const sort = args.sort === "asc" ? "asc" : "desc";
  const position = ALLOWED_POSITIONS.has(args.position) ? args.position : "all";
  const limit = args.limit;

  try {
    return await getTopPerformances({
      league,
      type: "plays",
      window,
      sort,
      position,
      limit,
    });
  } catch (err) {
    return { error: err?.message || "Failed to fetch top-rated plays." };
  }
}
