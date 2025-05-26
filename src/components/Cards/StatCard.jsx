import { Link} from "react-router-dom";
import getLeague from "../../HelperFunctions.js/getLeagueFromTeam";

export default function StatCard({ stats = [], opponent, date, gameId }) {
  if (!stats.length) {
    return (
      <div className="border border-zinc-700 bg-zinc-800 text-white rounded-lg shadow-md w-full max-w-3xl p-6 text-center">
        <p className="text-gray-400">No stats available.</p>
      </div>
    );
  }
  
  return (
    <Link to={`/${getLeague(opponent)}/games/${gameId}`}>
    <div className="relative border border-zinc-700 bg-zinc-800 p-6 text-center mb-6 rounded-xl shadow-lg transition-transform duration-200 hover:scale-105 cursor-pointer max-w-sm mx-auto">
      {/* Game info */}
      {(opponent || date) && (
        <div className="text-gray-400 text-sm mb-4">
          vs. {opponent} {date && <>on {date}</>}
        </div>
      )}

      {/* Stats */}
      <ul className="flex flex-row gap-20 justify-center">
        {stats.map((stat, i) => (
          <li key={i} className="flex flex-col items-center">
            <span className="text-sm">{stat.label}</span>
            <span className="font-semibold text-4xl mt-1">
              {stat.value}
              {stat.label.includes("%") && "%"}
            </span>
          </li>
        ))}
      </ul>
      </div>
    </Link>
  );
}
