import {Link} from "react-router-dom";
import slugify from "../HelperFunctions/slugify.js"

const OMIT_STATS = ["date", "id", "opponent"];

const STAT_LABELS = {
  points: "PTS",
  rebounds: "REB",
  assists: "AST",
  fg: "FG",
  fgPct: "FG%",
  threePt: "3PT",
  ft: "FT",
  minutes: "MIN",
  turnovers: "TO",
  plusMinus: "+/-",
  steals: "STL",
  blocks: "BLK"
};

function formatStatLabel(stat) {
  return STAT_LABELS[stat] || stat
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Pct$/, "%")
    .toUpperCase();
}

export default function BoxScore({league, game, stats }) {
  function getPlayersForTeam(teamName) {
    return stats
      .filter((p) => p.team === teamName)
      .map((p) => {
        if (!Array.isArray(p.recentGames)) return null;
        const stats = p.recentGames.find((g) => g.id === game.id); 
        return stats ? { name: p.name, ...stats } : null;
      })
      .filter(Boolean);
  }

  const homePlayers = getPlayersForTeam(game.homeTeam);
  const awayPlayers = getPlayersForTeam(game.awayTeam);

  const getStatHeaders = (players) => {
    const sample = players.find((p) => p && typeof p === "object");
    if (!sample) return [];
    return Object.keys(sample).filter(
      (key) => key !== "name" && !OMIT_STATS.includes(key)
    );
  };

  const statHeaders = [
    ...new Set([
      ...getStatHeaders(homePlayers),
      ...getStatHeaders(awayPlayers),
    ]),
  ];

  const renderTable = (team, players) => (
<div className="w-full bg-white/5 rounded-xl p-4 shadow">
  <h4 className="text-xl font-semibold mb-4 text-center">{team}</h4>
  <div className="overflow-x-auto">
    <table className="min-w-[600px] sm:min-w-full text-left border-separate border-spacing-y-2">
      <thead className="text-gray-400 text-xs sm:text-sm">
        <tr>
          <th className="py-1 px-2">Player</th>
          {statHeaders.map((stat) => (
            <th key={stat} className="py-1 px-2 text-right">
              {formatStatLabel(stat)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (

<tr key={p.name} className="text-white text-xs sm:text-sm">
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
      {p[stat] ?? "-"}
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
    {renderTable(game.homeTeam, homePlayers)}
    {renderTable(game.awayTeam, awayPlayers)}
  </div>
</div>

  );
}
