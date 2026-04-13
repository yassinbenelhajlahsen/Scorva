import { m } from "framer-motion";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import GameCard from "../cards/GameCard.jsx";
import slugify from "../../utils/slugify.js";
import { itemVariants } from "../../utils/motion.js";
import { formatDateShort } from "../../utils/formatDate.js";
import { queryKeys, queryFns } from "../../lib/query.js";

export default function FavoriteTeamsSection({ teams, compact = false, onRemove }) {
  const queryClient = useQueryClient();
  return (
    <div>
      <h2 className="text-xs uppercase tracking-widest text-text-tertiary font-semibold mb-4">Favorite Teams</h2>
      <div className="flex flex-col gap-3">
        {teams.map((team) => {
          const teamSlug = slugify(team.name);
          const recentGames = compact ? team.recentGames.slice(0, 3) : team.recentGames;

          return (
            <m.div
              key={team.id}
              variants={itemVariants}
              className={`w-full bg-surface-elevated border border-white/[0.08] rounded-2xl ${compact ? "p-3" : "p-5"} flex flex-col ${compact ? "" : "sm:flex-row"} gap-${compact ? "3" : "5"} items-stretch`}
            >
              <div className={`flex items-center ${compact ? "gap-2" : ""}`}>
                <Link
                  to={`/${team.league}/teams/${teamSlug}`}
                  className={`flex items-center gap-${compact ? "3" : "4"} shrink-0 hover:opacity-80 transition-opacity ${compact ? "flex-1 min-w-0" : "w-full sm:w-52"}`}
                  onMouseEnter={() => {
                    if (window.matchMedia("(hover: hover)").matches) {
                      queryClient.prefetchQuery({ queryKey: queryKeys.team(team.league, teamSlug), queryFn: queryFns.team(team.league, teamSlug), staleTime: 10_000 });
                    }
                  }}
                >
                  <img
                    loading="lazy"
                    src={team.logo_url || "/images/placeholder.png"}
                    alt={team.name}
                    className={`${compact ? "w-10 h-10" : "w-14 h-14"} object-contain`}
                  />
                  <div className="min-w-0">
                    {!compact && <p className="text-xs text-text-tertiary">{team.location}</p>}
                    <p className="text-sm font-semibold text-text-primary truncate">{team.name}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{team.record}</p>
                  </div>
                </Link>
                {compact && onRemove && (
                  <button
                    onClick={() => onRemove(team.id)}
                    aria-label={`Remove ${team.name}`}
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
                  {recentGames.length === 0 ? (
                    <p className="text-text-tertiary text-xs">No recent games</p>
                  ) : (
                    recentGames.map((game) => {
                      const homeScore = game.homescore ?? game.home_score;
                      const awayScore = game.awayscore ?? game.away_score;
                      const hasScore = homeScore != null && awayScore != null;

                      return (
                        <Link
                          key={game.id}
                          to={`/${team.league}/games/${game.id}`}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors text-xs"
                        >
                          <div className="flex items-center gap-1.5 shrink-0">
                            <img src={game.away_logo || game.awaylogo} alt="" className="w-4 h-4 object-contain" />
                            <span className="text-text-secondary">{game.away_shortname || game.awayshortname}</span>
                          </div>
                          {hasScore ? (
                            <span className="text-text-primary font-bold shrink-0">{awayScore} - {homeScore}</span>
                          ) : (
                            <span className="text-text-tertiary shrink-0">vs</span>
                          )}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-text-secondary">{game.home_shortname || game.homeshortname}</span>
                            <img src={game.home_logo || game.homelogo} alt="" className="w-4 h-4 object-contain" />
                          </div>
                          <span className="ml-auto text-text-tertiary whitespace-nowrap">{formatDateShort(game.date)}</span>
                        </Link>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 flex-1 min-w-0 pt-1">
                  {recentGames.length === 0 ? (
                    <p className="text-text-tertiary text-xs self-center">No recent games</p>
                  ) : (
                    recentGames.map((game) => (
                      <div key={game.id} className="flex-1 min-w-[13rem]">
                        <GameCard game={game} />
                      </div>
                    ))
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
