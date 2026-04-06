import { Link } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { useSimilarPlayers } from "../../hooks/data/useSimilarPlayers.js";
import slugify from "../../utils/slugify.js";
import Skeleton from "../ui/Skeleton.jsx";

function SimilarPlayerSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton className="w-24 h-3 rounded" />
        <Skeleton className="w-16 h-2.5 rounded" />
      </div>
    </div>
  );
}

export default function SimilarPlayersCard({ league, slug, season }) {
  const { players, loading } = useSimilarPlayers(league, slug, season);
  const show = loading || players.length > 0;

  return (
    <AnimatePresence>
      {show && (
        <m.div
          key="similar-players"
          className="shrink-0 overflow-hidden flex flex-col"
          style={{ width: "20rem" }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] p-5 h-full flex flex-col">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3">
              Similar Players
            </h3>
            <div className="flex flex-col flex-1 justify-between">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <SimilarPlayerSkeleton key={i} />
                  ))
                : players.map((player) => (
                    <Link
                      key={player.id}
                      to={`/${league}/players/${slugify(player.name)}`}
                      className="flex items-center gap-3 group transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:translate-x-0.5"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-overlay border border-white/[0.08] shrink-0">
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
                  ))}
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
