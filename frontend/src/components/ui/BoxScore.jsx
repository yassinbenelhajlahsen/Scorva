import { Link } from "react-router-dom";
import slugify from "../../utilities/slugify.js";

// Parse time strings like "35:34" or "20:34" into total seconds, or pass through numbers
function parseTime(val) {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const str = String(val);
  if (str.includes(":")) {
    const [m, s] = str.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }
  return parseFloat(str) || 0;
}

const NFL_OFFENSE = new Set(["QB", "RB", "FB", "WR", "TE", "OL", "OT", "OG", "C", "T", "G"]);
const NFL_DEFENSE = new Set(["DE", "DT", "NT", "LB", "OLB", "ILB", "MLB", "CB", "S", "FS", "SS", "DB", "SAF"]);
const NFL_SPECIAL = new Set(["K", "P", "LS", "KR", "PR", "PK"]);

const NHL_FORWARDS = new Set(["C", "LW", "RW", "F", "W"]);
const NHL_DEFENSE = new Set(["D", "LD", "RD"]);

function nflPositionRank(pos) {
  if (!pos) return 3;
  const p = pos.toUpperCase();
  if (NFL_OFFENSE.has(p)) return 0;
  if (NFL_DEFENSE.has(p)) return 1;
  if (NFL_SPECIAL.has(p)) return 2;
  return 3;
}

function nhlPositionRank(pos) {
  if (!pos) return 3;
  const p = pos.toUpperCase();
  if (NHL_FORWARDS.has(p)) return 0;
  if (NHL_DEFENSE.has(p)) return 1;
  if (p === "G") return 2;
  return 3;
}

function sortPlayers(players, league) {
  if (!players) return players;
  const sorted = [...players];

  if (league === "nba") {
    sorted.sort((a, b) => parseTime(b.stats?.MIN) - parseTime(a.stats?.MIN));
  } else if (league === "nhl") {
    sorted.sort((a, b) => {
      const rankDiff = nhlPositionRank(a.position) - nhlPositionRank(b.position);
      if (rankDiff !== 0) return rankDiff;
      return parseTime(b.stats?.TOI) - parseTime(a.stats?.TOI);
    });
  } else if (league === "nfl") {
    sorted.sort((a, b) => {
      const rankDiff = nflPositionRank(a.position) - nflPositionRank(b.position);
      if (rankDiff !== 0) return rankDiff;
      return (Number(a.jerseyNumber) || 99) - (Number(b.jerseyNumber) || 99);
    });
  }

  return sorted;
}

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
        {renderTable(homeTeam, sortPlayers(homeTeam.players, league))}
        {renderTable(awayTeam, sortPlayers(awayTeam.players, league))}
      </div>
    </div>
  );
}
