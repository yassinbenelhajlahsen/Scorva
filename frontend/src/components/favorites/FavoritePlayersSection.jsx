import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import StatCard from "../cards/StatCard.jsx";
import slugify from "../../utilities/slugify.js";
import { itemVariants } from "../../utilities/motion.js";
import { formatDateShort } from "../../utilities/formatDate.js";

const statKeysForLeague = {
  nba: [
    { key: "points", label: "PTS" },
    { key: "rebounds", label: "REB" },
    { key: "assists", label: "AST" },
  ],
  nfl: [
    { key: "yds", label: "YDS" },
    { key: "td", label: "TD" },
    { key: "interceptions", label: "INT" },
  ],
  nhl: [
    { key: "g", label: "G" },
    { key: "a", label: "A" },
    { key: "saves", label: "SV" },
  ],
};

export default function FavoritePlayersSection({ players }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-widest text-text-tertiary font-semibold mb-4">Favorite Players</h2>
      <div className="flex flex-col gap-3">
        {players.map((player) => {
          const statKeys = statKeysForLeague[player.league] || statKeysForLeague.nba;
          return (
            <motion.div
              key={player.id}
              variants={itemVariants}
              className="w-full bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 flex flex-col sm:flex-row gap-5 items-stretch"
            >
              <Link
                to={`/${player.league}/players/${slugify(player.name)}`}
                className="flex items-center gap-4 shrink-0 hover:opacity-80 transition-opacity w-full sm:w-52"
              >
                <img
                  src={player.image_url || "/images/placeholder.png"}
                  alt={player.name}
                  className="w-14 h-14 rounded-xl object-cover ring-1 ring-white/[0.08]"
                />
                <div>
                  <p className="text-sm font-semibold text-text-primary">{player.name}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{player.position} · #{player.jerseynum}</p>
                  <p className="text-xs text-text-secondary mt-1">{player.team_name}</p>
                </div>
              </Link>

              <div className="hidden sm:block w-px bg-white/[0.06] self-stretch shrink-0" />

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 flex-1 min-w-0 pt-1">
                {player.recentStats.length === 0 ? (
                  <p className="text-text-tertiary text-xs self-center">No recent games</p>
                ) : (
                  player.recentStats.map((stat) => {
                    const isHome = stat.hometeamid === player.team_id;
                    const opponent = isHome ? stat.away_shortname : stat.home_shortname;
                    const opponentLogo = isHome ? stat.away_logo : stat.home_logo;
                    const result = stat.winnerid
                      ? stat.winnerid === (isHome ? stat.hometeamid : stat.awayteamid) ? "W" : "L"
                      : null;
                    const statsArr = statKeys
                      .map((s) => ({ label: s.label, value: stat[s.key] ?? "-" }))
                      .filter((s) => s.value !== "-");
                    return (
                      <div key={stat.game_id} className="w-full sm:flex-1 sm:min-w-[10rem]">
                        <StatCard
                          stats={statsArr}
                          opponent={opponent}
                          date={formatDateShort(stat.date)}
                          gameId={stat.game_id}
                          league={player.league}
                          isHome={isHome}
                          opponentLogo={opponentLogo}
                          result={result}
                          status={stat.status}
                          id={player.id}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
