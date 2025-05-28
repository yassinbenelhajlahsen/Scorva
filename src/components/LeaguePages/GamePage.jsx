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

  const isFinal = game.status.includes("Final");
  const homeWon = isFinal && game.homeScore > game.awayScore;
  const awayWon = isFinal && game.awayScore > game.homeScore;

  return (
    <>
   {/* Team matchup section with scores */}
<div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 mb-8">
  {/* Home Team */}
  <div className="flex items-center gap-3 sm:gap-4">
    <img
      src={getLogoFromTeam(game.homeTeam)}
      alt={`${game.homeTeam} logo`}
      className="w-30 h-30 sm:w-40 sm:h-40 object-contain"
      onError={(e) => {
        e.target.onerror = null;
        e.target.src = "/backupTeamLogo.png";
      }}
    />
    <div className="text-left">
      <Link
        to={`/${league}/teams/${slugify(game.homeTeamFull)}`}
        className="text-xl sm:text-6xl font-bold hover:text-orange-400 transition"
      >
        {game.homeTeam}
      </Link>
      {isFinal && (
        <div
          className={`text-lg sm:text-4xl font-semibold ${
            homeWon ? "text-green-400" : "text-red-400"
          }`}
        >
          {game.homeScore}
        </div>
      )}
    </div>
  </div>

  {/* VS divider */}
  <div className="text-xl sm:text-5xl font-semibold">vs</div>

  {/* Away Team */}
  <div className="flex items-center gap-3 sm:gap-4">
    <img
      src={getLogoFromTeam(game.awayTeam)}
      alt={`${game.awayTeam} logo`}
      className="w-30 h-30 sm:w-40 sm:h-40 object-contain"
      onError={(e) => {
        e.target.onerror = null;
        e.target.src = "/backupTeamLogo.png";
      }}
    />
    <div className="text-left">
      <Link
        to={`/${league}/teams/${slugify(game.awayTeamFull)}`}
        className="text-xl sm:text-6xl font-bold hover:text-orange-400 transition"
      >
        {game.awayTeam}
      </Link>
      {isFinal && (
        <div
          className={`text-lg sm:text-4xl font-semibold ${
            awayWon ? "text-green-400" : "text-red-400"
          }`}
        >
          {game.awayScore}
        </div>
      )}
    </div>
  </div>
</div>

        <div className="grid grid-cols-2 gap-x-40 gap-y-4 p-6 max-w-md mx-auto text-left">
          <p className="text-lg">Date</p>
          <p className="font-semibold">{game.date}</p>
          <p className="text-lg">Status</p>
          <p className="font-semibold">{game.status}</p>
          <p className="text-lg">Location</p>
          <p className="font-semibold"> {game.venue} ({game.homeTeam})</p>
          <p className="text-lg">Broadcast</p>
          <p className="font-semibold">{game.broadcast}</p>
        </div>
</>
  );
}
