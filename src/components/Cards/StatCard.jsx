import { Link } from "react-router-dom";
import getLeague from "../../HelperFunctions/getLogoFromTeam.js";

export default function StatCard({ stats = [], opponent, date, gameId }) {
  if (!stats.length) {
    return (
      <div className="border border-zinc-700 bg-zinc-800 text-white rounded-lg shadow-md w-full max-w-3xl p-6 text-center">
        <p className="text-gray-400">No stats available.</p>
      </div>
    );
  }

  const league = getLeague(opponent);

  return (
    <Link to={`/${league}/games/${gameId}`} className="group block">
      <div className="
      relative border border-zinc-700 bg-zinc-800 p-6 
      text-center mb-6 rounded-xl shadow-lg transition-all duration-300 
      hover:scale-105 cursor-pointer max-w-sm mx-auto overflow-hidden">
        {/* Game info */}
        {(opponent || date) && (
          <div className="text-gray-400 text-sm mb-4">
            vs. {opponent} {date && <>on {date}</>}
          </div>
        )}

        {/* All stats, default max-height hides overflow */}
        <ul className="
          flex flex-wrap justify-center gap-10 
          max-h-18 group-hover:max-h-[500px] 
          overflow-hidden transition-[max-height] duration-500 ease-in-out
        ">
          {stats.map((stat, i) => (
            <li key={i} className="flex flex-col items-center min-w-[60px]">
              <span className="text-sm text-gray-400">{stat.label}</span>
              <span className="font-semibold text-3xl mt-1">
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
