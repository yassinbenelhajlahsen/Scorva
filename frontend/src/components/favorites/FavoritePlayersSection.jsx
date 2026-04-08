import { m } from "framer-motion";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import StatCard from "../cards/StatCard.jsx";
import slugify from "../../utils/slugify.js";
import { itemVariants } from "../../utils/motion.js";
import { formatDateShort } from "../../utils/formatDate.js";
import { queryKeys, queryFns } from "../../lib/query.js";

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

export default function FavoritePlayersSection({ players, compact = false, onRemove }) {
  const queryClient = useQueryClient();
  return (
    <div>
      <h2 className="text-xs uppercase tracking-widest text-text-tertiary font-semibold mb-4">Favorite Players</h2>
      <div className="flex flex-col gap-3">
        {players.map((player) => {
          const statKeys = statKeysForLeague[player.league] || statKeysForLeague.nba;
          const playerSlug = slugify(player.name);
          const recentStats = compact ? player.recentStats.slice(0, 2) : player.recentStats;

          return (
            <m.div
              key={player.id}
              variants={itemVariants}
              className={`w-full bg-surface-elevated border border-white/[0.08] rounded-2xl ${compact ? "p-3" : "p-5"} flex flex-col ${compact ? "" : "sm:flex-row"} gap-${compact ? "3" : "5"} items-stretch`}
            >
              <div className={`flex items-center ${compact ? "gap-2" : ""}`}>
                <Link
                  to={`/${player.league}/players/${playerSlug}`}
                  className={`flex items-center gap-${compact ? "3" : "4"} shrink-0 hover:opacity-80 transition-opacity ${compact ? "flex-1 min-w-0" : "w-full sm:w-52"}`}
                  onMouseEnter={() => {
                    if (window.matchMedia("(hover: hover)").matches) {
                      queryClient.prefetchQuery({ queryKey: queryKeys.player(player.league, playerSlug, null), queryFn: queryFns.player(player.league, playerSlug, null), staleTime: 10_000 });
                    }
                  }}
                >
                  <img
                    loading="lazy"
                    src={player.image_url || "/images/placeholder.png"}
                    alt={player.name}
                    className={`${compact ? "w-10 h-10" : "w-14 h-14"} rounded-xl object-cover ring-1 ring-white/[0.08]`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{player.name}</p>
                    <p className="text-xs text-text-tertiary mt-0.5">{player.position} · #{player.jerseynum}</p>
                    {!compact && <p className="text-xs text-text-secondary mt-1">{player.team_name}</p>}
                  </div>
                </Link>
                {compact && onRemove && (
                  <button
                    onClick={() => onRemove(player.id)}
                    aria-label={`Remove ${player.name}`}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-text-tertiary hover:text-loss hover:bg-loss/10 transition-all duration-150 shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="4" y1="4" x2="16" y2="16" />
                      <line x1="16" y1="4" x2="4" y2="16" />
                    </svg>
                  </button>
                )}
              </div>

              {!compact && <div className="hidden sm:block w-px bg-white/[0.06] self-stretch shrink-0" />}

              {compact ? (
                <div className="flex flex-col gap-1.5">
                  {recentStats.length === 0 ? (
                    <p className="text-text-tertiary text-xs">No recent games</p>
                  ) : (
                    recentStats.map((stat) => {
                      const isHome = stat.hometeamid === player.team_id;
                      const opponent = isHome ? stat.away_shortname : stat.home_shortname;
                      const opponentLogo = isHome ? stat.away_logo : stat.home_logo;
                      const result = stat.winnerid
                        ? stat.winnerid === (isHome ? stat.hometeamid : stat.awayteamid) ? "W" : "L"
                        : null;
                      const statsInline = statKeys
                        .map((s) => ({ label: s.label, value: stat[s.key] }))
                        .filter((s) => s.value != null && s.value !== "-");

                      return (
                        <Link
                          key={stat.game_id}
                          to={`/${player.league}/games/${stat.game_id}?tab=analysis#${playerSlug}`}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-xs"
                        >
                          {result && (
                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${result === "W" ? "text-win bg-win/10" : "text-loss bg-loss/10"}`}>
                              {result}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 text-text-secondary shrink-0">
                            {isHome ? "vs" : "@"}
                            {opponentLogo && (
                              <img src={opponentLogo} alt="" className="w-4 h-4 object-contain" />
                            )}
                            {opponent}
                          </span>
                          <span className="text-text-tertiary shrink-0">{formatDateShort(stat.date)}</span>
                          <span className="ml-auto text-text-primary font-medium whitespace-nowrap">
                            {statsInline.map((s) => `${s.value} ${s.label}`).join(" · ")}
                          </span>
                        </Link>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 flex-1 min-w-0 pt-1">
                  {recentStats.length === 0 ? (
                    <p className="text-text-tertiary text-xs self-center">No recent games</p>
                  ) : (
                    recentStats.map((stat) => {
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
                            playerName={player.name}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </m.div>
          );
        })}
      </div>
    </div>
  );
}
