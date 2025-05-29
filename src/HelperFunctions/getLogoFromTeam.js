import nbaTeams from "../mock/mockNbaData/nbaTeams.js";
import nflTeams from "../mock/mockNflData/nflTeams.js";
import nhlTeams from "../mock/mockNhlData/nhlTeams.js";
import normalize from "./Normalize.js";

export default function getTeamLogo(teamName){
  const normalized = normalize(teamName);
  const allTeams = [...nbaTeams, ...nflTeams, ...nhlTeams];

  const team = allTeams.find((t) =>
    normalize(t.name).includes(normalized) || normalized.includes(normalize(t.name))
  );

  return team?.logo || null;
};