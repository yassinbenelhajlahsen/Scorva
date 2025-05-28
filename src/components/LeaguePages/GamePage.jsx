import { Link, useParams } from "react-router-dom";
import nbaGames from "../../mock/mockNbaData/nbaGames.js";
import nflGames from "../../mock/mockNflData/nflGames";
import nhlGames from "../../mock/mockNhlData/nhlGames";

import getLogoFromTeam from "../getLogoFromTeam.js";
const leagueMap = {
  nba: nbaGames,
  nfl: nflGames,
  nhl: nhlGames,
};

const slugify = (name) => name.toLowerCase().replace(/\s+/g, "-");

export default function GamePage() {
  const { league, gameId } = useParams();

  const games = leagueMap[league.toLowerCase()] || [];
  const game = games.find((g) => String(g.id) === String(gameId));

  if (!game) return <div className="text-white">Game not found</div>;

  const isFinal = game.status === "Final";
  const homeWon = isFinal && game.homeScore > game.awayScore;
  const awayWon = isFinal && game.awayScore > game.homeScore;

  return (
    <div className="text-white text-center p-6">
      {/* Logos and matchup */}
      <div className="flex items-center justify-center gap-8 mb-8">
        <img
  src={getLogoFromTeam(game.homeTeam)}
  alt={`${game.homeTeam} logo`}
  className="w-40 h-40 object-contain"
  onError={(e) => {
    e.target.onerror = null; 
    e.target.src = "/backupTeamLogo.png"; 
  }}
/>
        <h2 className="text-5xl md:text-8xl font-bold mx-4 whitespace-nowrap">
          <Link
            to={`/${league}/teams/${slugify(game.homeTeamFull)}`}
            className="hover:text-orange-400 transition"
          >
            {game.homeTeam}
          </Link>
          {" "}vs{" "}
          <Link
            to={`/${league}/teams/${slugify(game.awayTeamFull)}`}
            className="hover:text-orange-400 transition"
          >
            {game.awayTeam}
          </Link>
        </h2>
        <img
          src={getLogoFromTeam(game.awayTeam)}
          alt={`${game.awayTeam} logo`}
          className="w-40 h-40 object-contain"
          onError={(e) => {
    e.target.onerror = null; 
    e.target.src = "/backupTeamLogo.png"; 
  }}
        />
      </div>
      {/* Scores row */}
      {isFinal && (
        <div className="flex items-center justify-center gap-40 mb-12">
          <div
            className={`text-5xl font-semibold ${
              homeWon ? "text-green-400" : "text-red-400"
            }`}
          >
            {game.homeScore}
          </div>
          <div
            className={`text-5xl font-semibold ${
              awayWon ? "text-green-400" : "text-red-400"
            }`}
          >
            {game.awayScore}
          </div>
        </div>
      )}
      <p className="text-lg">Date: {game.date}</p>
      <p className="text-lg">Status: {game.status}</p>
      <p className="text-lg">Location: {game.venue}</p>
      <p className="text-lg">Broadcast: {game.broadcast}</p>
    </div>
  );
}
