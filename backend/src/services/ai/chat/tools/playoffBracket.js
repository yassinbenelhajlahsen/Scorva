import { getNbaPlayoffs } from "../../../standings/playoffsService.js";
import { getNhlPlayoffs } from "../../../standings/nhlPlayoffsService.js";
import { getNflPlayoffs } from "../../../standings/nflPlayoffsService.js";
import { getCurrentSeason } from "../../../../cache/seasons.js";

const HANDLERS = {
  nba: getNbaPlayoffs,
  nhl: getNhlPlayoffs,
  nfl: getNflPlayoffs,
};

export async function getPlayoffBracket({ league, season }) {
  const handler = HANDLERS[league];
  if (!handler) return { error: `Invalid league: ${league}` };
  const useSeason = season || (await getCurrentSeason(league));
  const bracket = await handler(useSeason);
  return { league, season: useSeason, bracket };
}
