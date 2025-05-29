import { Link, useParams } from "react-router-dom";
import nbaGames from "../../mock/mockNbaData/nbaGames.js";
import nflGames from "../../mock/mockNflData/nflGames";
import nhlGames from "../../mock/mockNhlData/nhlGames";

import nbaStats from "../../mock/mockNbaData/nbaStats.js";
import getLogoFromTeam from "../../HelperFunctions/getLogoFromTeam.js";
import BoxScore from "../BoxScore.jsx";
import slugify from "../../HelperFunctions/slugify.js"
import getLeague from "../../HelperFunctions/getLeagueFromTeam.js";
import computeTopPlayers from "../../HelperFunctions/topPlayers.js";
import TopPerformerCard from "../Cards/TopPerformerCard.jsx";
import nflStats from "../../mock/mockNflData/nflStats.js";
import nhlStats from "../../mock/mockNhlData/nhlStats.js";

const statsMap = {
  nba: nbaStats,
  nfl: nflStats,
  nhl: nhlStats,
};

const leagueMap = {
  nba: nbaGames,
  nfl: nflGames,
  nhl: nhlGames,
};


export default function GamePage() {

  const { league, gameId } = useParams();
  const games = leagueMap[league.toLowerCase()] || [];
  const game  = games.find(g => String(g.id) === String(gameId));
  if (!game) return <div>Game not found</div>;

  const allPlayerStats = statsMap[league.toLowerCase()] || [];

  const { topPerformer, topScorer, impactPlayer } =
    computeTopPlayers(game, allPlayerStats);




  if (!game) return <div className="text-white">Game not found</div>;

  const isFinal = game.status.includes("Final");
  const homeWon = isFinal && game.homeScore > game.awayScore;
  const awayWon = isFinal && game.awayScore > game.homeScore;
  console.log(allPlayerStats)
  return (
    <>
   {/* Team matchup section with scores */}
<div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 mt-6 mb-8">
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

        <div className="flex flex-col lg:flex-row justify-center px-6 sm:px-6 mb-12">
  {/* Game info on the left */}
  <div className="grid grid-cols-2 gap-y-4 text-left max-w-md w-full">
    <p className="text-lg">Date</p>
    <p className="font-semibold">{game.date}</p>
    <p className="text-lg">Status</p>
    <p className="font-semibold">{game.status}</p>
    <p className="text-lg">Location</p>
    <p className="font-semibold">{game.venue} ({game.homeTeam})</p>
    <p className="text-lg">Broadcast</p>
    <p className="font-semibold">{game.broadcast}</p>
  </div>

  {/* Top performers on the right */}
  <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 max-w-6xl mx-auto">
  <TopPerformerCard title="Top Performer" player={topPerformer} league={league} />
  <TopPerformerCard title="Top Scorer" player={topScorer} league={league} />
  <TopPerformerCard title="Impact Player" player={impactPlayer} league={league} />
</div>
</div>
        <BoxScore 
          game = {game}
          stats = {allPlayerStats}
          league = {getLeague(game.homeTeam)}
          ></BoxScore>
</>
  );
}
