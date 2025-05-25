import nbaTeams from "../mock/mockNbaData/nbaTeams.js";
import nflTeams from "../mock/mockNflData/nflTeams.js";
import nhlTeams from "../mock/mockNhlData/nhlTeams.js";
import backupLogo from "../assets/backupTeamLogo.png";
import { Link } from "react-router-dom";

const leagueMap = {
  nba: nbaTeams,
  nfl: nflTeams,
  nhl: nhlTeams,
};
const normalize = (str) =>str?.toLowerCase().replace(/[^a-z]/g, "");

const getTeamLogo = (teamName) => {
  const normalized = normalize(teamName);
  const allTeams = [...nbaTeams, ...nflTeams, ...nhlTeams];

  const team = allTeams.find((t) =>
    normalize(t.name).includes(normalized) || normalized.includes(normalize(t.name))
  );

  return team?.logo || null;
};



export default function GameCard({ game }) {
  const isFinal = game.status === "Final";
  const homeWon = isFinal && game.homeScore > game.awayScore;
  const awayWon = isFinal && game.awayScore > game.homeScore;


const getLeague = (teamName) => {
  const normalized = normalize(teamName);

  for (const [league, teams] of Object.entries(leagueMap)) {
    if (teams.some((t) => normalize(t.name).includes(normalized))) {
      return league;
    }
  }

  return null;
};

const league = getLeague(game.homeTeam);
if (!league) return null;




  return (
    <Link to={`/${league}/games/${game.id}`} className="no-underline">
    <div className="relative border border-zinc-700 bg-zinc-800 p-6 text-center mb-6 rounded-xl shadow-lg transition-transform duration-200 hover:scale-105 cursor-pointer max-w-md mx-auto">
      <div className="flex items-center justify-between gap-6">
        {/* Home Team Logo + Info */}
        <div className="flex flex-col items-center">
          {getTeamLogo(game.homeTeam) && (
            <img
              src={getTeamLogo(game.homeTeam)}
              alt={`${game.homeTeam} logo`}
              className="w-16 h-16 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = backupLogo;
              }}
            />
          )}
          <div className="text-lg font-bold text-white mt-2">
            {game.homeTeam}
          </div>
          {isFinal && (
            <div
              className={`text-lg font-semibold ${
                homeWon ? "text-green-400" : "text-red-400"
              }`}
            >
              {game.homeScore}
            </div>
          )}
        </div>

        {/* Center Info */}
        <div className="flex flex-col items-center flex-1">
          <span className="text-sm text-gray-400 mb-1">{game.date}</span>
          <div className="text-sm text-gray-300">vs</div>
          <p className="mt-1 text-sm text-gray-300">
            Status: <span className="text-white">{game.status}</span>
          </p>
        </div>

        {/* Away Team Logo + Info */}
        <div className="flex flex-col items-center">
          {getTeamLogo(game.awayTeam) && (
            <img
              src={getTeamLogo(game.awayTeam)}
              alt={`${game.awayTeam} logo`}
              className="w-16 h-16 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = backupLogo;
              }}
            />
          )}
          <div className="text-lg font-bold text-white mt-2">
            {game.awayTeam}
          </div>
          {isFinal && (
            <div
              className={`text-lg font-semibold ${
                awayWon ? "text-green-400" : "text-red-400"
              }`}
            >
              {game.awayScore}
            </div>
          )}
        </div>
      </div>
    </div>
  </Link>
  );
}
