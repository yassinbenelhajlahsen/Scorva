import nbaGames from "../mock/mockNbaData/nbaGames.js";
import nflGames from "../mock/mockNflData/nflGames.js";
import nhlGames from "../mock/mockNhlData/nhlGames.js";

const leagueData = {
  nba: {
    logo: "/NBAlogo.png",
    games: nbaGames,
    links: [
      { label: "Players", to: "/nba/players" },
      { label: "Teams", to: "/nba/teams" },
    ],
  },
  nfl: {
    logo: "NFLlogo.png",
    games: nflGames,
    links: [
      { label: "Players", to: "/nfl/players" },
      { label: "Teams", to: "/nfl/teams" },
    ],
  },
  nhl: {
    logo: "NHLlogo.png",
    games: nhlGames,
    links: [
      { label: "Players", to: "/nhl/players" },
      { label: "Teams", to: "/nhl/teams" },
    ],
  },
};

export default leagueData;