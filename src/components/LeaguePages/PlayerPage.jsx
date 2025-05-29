import { useParams, Link } from "react-router-dom";
import nbaPlayers from "../../mock/mockNbaData/nbaPlayers.js";
import nflPlayers from "../../mock/mockNflData/nflPlayers.js";
import nhlPlayers from "../../mock/mockNhlData/nhlPlayers.js";
import PlayerAvgCard from "../Cards/PlayerAvgCard.jsx";
import nbaStats from "../../mock/mockNbaData/nbaStats.js";
import StatCard from "../Cards/StatCard.jsx";
import nflStats from "../../mock/mockNflData/nflStats.js";
import nhlStats from "../../mock/mockNhlData/nhlStats.js";

const slugify = name => name.toLowerCase().replace(/\s+/g, "-");

const statConfigs = {
  nba: [
    { key: "points",    label: "PTS" },
    { key: "rebounds",  label: "REB" },
    { key: "assists",   label: "AST" },
    { key: "fg",        label: "FG" },
    { key: "threePt",   label: "3PT" },
    { key: "ft",        label: "FT" },
    { key: "turnovers", label: "TO" },
    { key: "plusMinus", label: "+/-" },
    { key: "minutes",   label: "MINS" }
  ],
  nfl: [
    { key: "YDS",      label: "YDS" },
    { key: "TD",       label: "TD"  },
    { key: "INT",        label: "INT"  },
    { key: "CMPpct",    label: "CMP%"   },
    { key: "SACK",       label: "SACK"  },
    { key: "ATT", label: "ATT"  },
  ],
  nhl: [
    { key: "G",       label: "G"   },
    { key: "A",     label: "A"   },
    { key: "S",       label: "SOG" },
    { key: "plusMinus",   label: "+/-" },
    { key: "MOI", label: "PIM" }
  ]
};

export default function PlayerPage() {
  const { league, playerId } = useParams();
  const key = league?.toLowerCase();

  // map each league code to its data sources
  const playersMap = { nba: nbaPlayers, nfl: nflPlayers, nhl: nhlPlayers };
  const statsMap   = { nba: nbaStats,   nfl: nflStats,   nhl: nhlStats   };

  const players  = playersMap[key] || [];
  const allStats = statsMap[key]   || [];

  // find the player by slugified name
  const player = players.find(p => slugify(p.name) === playerId);

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold">Player not found</h1>
        <Link
          to={`/${league}/players`}
          className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
        >
          Return to Players
        </Link>
      </div>
    );
  }

  const stats = allStats.find(s => s.id === player.id);

  return (
    <>
      <Link
        to={`/${league}/players`}
        className="mt-6 inline-block bg-white text-red-500 font-semibold py-4 px-8 ml-6 rounded-lg shadow transform transition-transform duration-300 hover:bg-gray-200 hover:scale-105"
      >
        Return to Players Page
      </Link>

      <div className="flex flex-col md:flex-row gap-8 p-8 text-white">
        {/* Player Info */}
        <div className="flex-1">
          <h1 className="text-6xl font-bold mb-4">{player.name}</h1>
          <img
            src={player.image || "/images/placeholder.png"}
            alt={player.name}
            className="w-80 h-80 object-cover rounded-b-4xl mb-4"
          />
        </div>

        <div className="grid grid-cols-[max-content_auto] gap-x-20">
          <p>Height/Weight</p>
          <p className="font-semibold">
            {player.height} / {player.weight}
          </p>
          <p>Position</p>
          <p className="font-semibold">{player.position}</p>
          <p>Jersey Number</p>
          <p>
            <span className="font-bold">#{player.jerseyNum}</span>
          </p>
          <p>Birthdate</p>
          <p className="font-semibold">{player.birthdate}</p>
          <p>Draft Info</p>
          <p className="font-semibold">{player.draftInfo}</p>
          <p>Team</p>
          <Link
            to={`/${league}/teams/${slugify(player.team)}`}
            className="hover:text-orange-300 transition underline text-orange-400 font-semibold"
          >
            {player.team}
          </Link>
        </div>

        {stats && (
          <div className="mt-20">
            <PlayerAvgCard
              league={league}
              position={player.position}
              averages={stats.averages}
              season={stats.season}
            />
          </div>
        )}
      </div>

      <h1 className="font-semibold text-4xl mt-6 p-6">Recent Performances</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-6">
        {stats?.recentGames?.map((game, i) => {
          // build stats props from config
          const config = statConfigs[key] || [];
          const statsProps = config.map(({ key: statKey, label }) => ({
            label,
            value: game[statKey] ?? "-"
          }));
          return (
            <StatCard
              key={i}
              stats={statsProps}
              opponent={game.opponent}
              date={game.date}
              gameId={game.id}
            />
          );
        })}
      </div>
    </>
  );
}
