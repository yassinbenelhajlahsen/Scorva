import { Link, useSearchParams } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";
import { useSimilarPlayers } from "../../hooks/data/useSimilarPlayers.js";
import { useDuplicatePlayerSlugs } from "../../hooks/data/useDuplicatePlayerSlugs.js";
import { playerSlug } from "../../utils/playerUrl.js";
import buildSeasonUrl from "../../utils/buildSeasonUrl.js";

export default function SimilarPlayersCard({ league, slug, season }) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlSeason = searchParams.get("season") || null;
  const { players, loading } = useSimilarPlayers(league, slug, season);
  const dupeSlugs = useDuplicatePlayerSlugs(league);
  const show = !loading && players.length > 0;

  return (
    <AnimatePresence>
      {show && (
        <m.div
          key="similar-players"
          className="flex flex-col w-full lg:w-[400px] lg:shrink-0"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="w-full max-w-sm">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-text-tertiary mb-3 pl-3">
              Similar Players
            </h3>
            <div className="flex flex-col">
              {players.map((player, idx) => {
                const slug = playerSlug(player, dupeSlugs);
                return (
                  <Link
                    key={player.id}
                    to={buildSeasonUrl(`/${league}/players/${slug}`, urlSeason)}
                    onMouseEnter={() => queryClient.prefetchQuery({ queryKey: queryKeys.player(league, slug, urlSeason), queryFn: queryFns.player(league, slug, urlSeason), staleTime: 10_000 })}
                    className={`group relative flex items-center gap-3 pl-3 pr-3 py-3 transition-colors duration-200 hover:bg-white/[0.03] ${idx < players.length - 1 ? "border-b border-white/[0.04]" : ""}`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent group-hover:bg-accent transition-colors duration-200" />
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-overlay/40 border border-white/[0.06] shrink-0">
                      {player.imageUrl ? (
                        <img
                          src={player.imageUrl}
                          alt={player.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-full h-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-sm font-semibold leading-tight truncate group-hover:text-accent transition-colors duration-150">
                        {player.name}
                      </p>
                      <p className="text-text-tertiary text-xs mt-0.5 truncate">
                        {[player.position, player.teamShortName].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
