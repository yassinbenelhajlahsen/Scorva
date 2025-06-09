import { Link } from "react-router-dom";
import slugify from "../HelperFunctions/slugify.js";

export default function BoxScore({ league, homeTeam, awayTeam }) {
  // 1. Extract stat keys from first available player with stats
  const extractStatHeaders = (players) => {
    const sample = players.find((p) => p?.stats && typeof p.stats === "object");
    if (!sample) return [];
    return Object.keys(sample.stats);
  };

  const statHeaders = [
    ...new Set([
      ...extractStatHeaders(homeTeam.players),
      ...extractStatHeaders(awayTeam.players),
    ]),
  ];

  const renderTable = (team, players) => (
    <div className="w-full bg-white/5 rounded-xl p-4 shadow">
      <h4 className="text-xl font-semibold mb-4 text-center">{team.info.name}</h4>
      <div className="overflow-x-auto">
        <table className="min-w-[600px] sm:min-w-full text-left border-separate border-spacing-y-2">
          <thead className="text-gray-400 text-xs sm:text-sm">
            <tr>
              <th className="py-1 px-2">Player</th>
              {statHeaders.map((stat) => (
                <th key={stat} className="py-1 px-2 text-right">
                  {stat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr  id={`player-${p.id}`} key={p.id} className="text-xs sm:text-sm">
                <td className="py-1 px-2 font-medium">
                  <Link
                    to={`/${league}/players/${slugify(p.name)}`}
                    className="hover:text-orange-300 transition underline underline-offset-2 text-orange-400"
                  >
                    {p.name}
                  </Link>
                </td>
                {statHeaders.map((stat) => (
                  <td key={stat} className="py-1 px-2 text-right">
                    {p.stats?.[stat] ?? "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (statHeaders.length === 0) {
    return (
      <div className="text-center text-gray-400 mt-8">
        No box score available for this game. Check back once the game has finished.
      </div>
    );
  }

  return (
    <div className="mt-12 w-full px-2 sm:px-6">
      <h3 className="text-2xl sm:text-3xl font-bold mb-6 text-center">
        Box Score
      </h3>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2">
        {renderTable(homeTeam, homeTeam.players)}
        {renderTable(awayTeam, awayTeam.players)}
      </div>
    </div>
  );
}
