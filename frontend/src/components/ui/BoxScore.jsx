import { Link } from "react-router-dom";
import slugify from "../../utilities/slugify.js";

export default function BoxScore({ league, homeTeam, awayTeam }) {
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
    <div className="w-full bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.35)] flex flex-col h-full">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <h4 className="text-base font-semibold text-text-primary">
          {team.info.name}
        </h4>
      </div>
      <div className="overflow-x-auto scrollbar-thin flex-1 flex flex-col">
        <table className="min-w-[600px] sm:min-w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="py-2.5 px-5 text-[10px] uppercase tracking-widest text-text-tertiary font-medium">Player</th>
              {statHeaders.map((stat) => (
                <th
                  key={stat}
                  className="py-2.5 px-3 text-right text-[10px] uppercase tracking-widest text-text-tertiary font-medium whitespace-nowrap"
                >
                  {stat}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {players.map((p) => (
              <tr
                id={`player-${p.id}`}
                key={p.id}
                className="hover:bg-surface-overlay/60 transition-colors duration-150"
              >
                <td className="py-2.5 px-5 font-medium whitespace-nowrap">
                  <Link
                    to={`/${league}/players/${slugify(p.name)}`}
                    className="text-accent hover:text-accent-hover transition-colors duration-200 text-sm"
                  >
                    {p.name}
                  </Link>
                </td>
                {statHeaders.map((stat) => (
                  <td
                    key={stat}
                    className="py-2.5 px-3 text-right text-sm text-text-secondary whitespace-nowrap tabular-nums"
                  >
                    {p.stats?.[stat] ?? "0"}
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
      <div className="text-center text-text-tertiary text-sm mt-8">
        No box score available for this game. Check back once the game has finished.
      </div>
    );
  }

  return (
    <div className="mt-12 w-full px-2 sm:px-6">
      <h3 className="text-2xl font-bold tracking-tight text-text-primary mb-6 text-center">
        Box Score
      </h3>
      <div
        className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start"
        style={{ gridAutoRows: "1fr" }}
      >
        {renderTable(homeTeam, homeTeam.players)}
        {renderTable(awayTeam, awayTeam.players)}
      </div>
    </div>
  );
}
