import nbaTeams from "../mock/mockNbaData/nbaTeams.js";
import nflTeams from "../mock/mockNflData/nflTeams.js";
import nhlTeams from "../mock/mockNhlData/nhlTeams.js";
import normalize from "../HelperFunctions/Normalize.js";
const leagueMap = {
  nba: nbaTeams,
  nfl: nflTeams,
  nhl: nhlTeams,
};

export default function getLeague(teamName) {
  const normalized = normalize(teamName);

  for (const [league, teams] of Object.entries(leagueMap)) {
    if (teams.some((t) => normalize(t.name).includes(normalized))) {
      return league;
    }
  }
  return null;
};