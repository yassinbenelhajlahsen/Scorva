import nbaTeams from '../mock/nbaTeams.js';

const getTeamLogo = (teamName) => {
  const team = nbaTeams.find(t => t.name.includes(teamName));
  return team && team.logo ? team.logo : null;
};

export default function GameCard({ game}) {
  const isFinal = game.status === "Final";
  const homeWon = isFinal && game.homeScore > game.awayScore;
  const awayWon = isFinal && game.awayScore > game.homeScore;

  return (
    <div className="relative border border-zinc-700 bg-zinc-800 p-6 text-center mb-6 rounded-xl shadow-lg transition-transform duration-200 hover:scale-105 cursor-pointer max-w-md mx-auto">
      <div className="flex items-center justify-between gap-6">
        {/* Home Team Logo + Info */}
        <div className="flex flex-col items-center">
          {getTeamLogo(game.homeTeam) && (
            <img
              src={getTeamLogo(game.homeTeam)}
              alt={`${game.homeTeam} logo`}
              className="w-16 h-16 object-contain"
            />
          )}
          <div className="text-lg font-bold text-white mt-2">{game.homeTeam}</div>
          {isFinal && (
            <div className={`text-lg font-semibold ${homeWon ? "text-green-400" : "text-red-400"}`}>
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
            />
          )}
          <div className="text-lg font-bold text-white mt-2">{game.awayTeam}</div>
          {isFinal && (
            <div className={`text-lg font-semibold ${awayWon ? "text-green-400" : "text-red-400"}`}>
              {game.awayScore}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}