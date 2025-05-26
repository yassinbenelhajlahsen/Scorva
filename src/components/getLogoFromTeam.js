import nbaTeams from "../mock/mockNbaData/nbaTeams.js";
import nflTeams from "../mock/mockNflData/nflTeams.js";
import nhlTeams from "../mock/mockNhlData/nhlTeams.js";

const normalize = (str) =>str?.toLowerCase().replace(/[^a-z]/g, "");

export default function getTeamLogo(teamName){
  const normalized = normalize(teamName);
  const allTeams = [...nbaTeams, ...nflTeams, ...nhlTeams];

  const team = allTeams.find((t) =>
    normalize(t.name).includes(normalized) || normalized.includes(normalize(t.name))
  );

  return team?.logo || null;
};