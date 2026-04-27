import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { m } from "framer-motion";

import PlayerStatusBadge from "../player/PlayerStatusBadge.jsx";
import slugify from "../../utils/slugify.js";
import buildSeasonUrl from "../../utils/buildSeasonUrl.js";
import { queryKeys, queryFns } from "../../lib/query.js";
import { containerVariants, itemVariants } from "../../utils/motion.js";

function canHover() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: hover)").matches;
}

function RosterCard({ league, season, player, showStatus }) {
  const queryClient = useQueryClient();
  const slug = slugify(player.name);
  const href = buildSeasonUrl(`/${league}/players/${slug}`, season);
  const renderStatus = showStatus && player.status && player.status !== "available";

  function handleHover() {
    if (!canHover()) return;
    queryClient.prefetchQuery({
      queryKey: queryKeys.player(league, slug, season),
      queryFn: queryFns.player(league, slug, season),
      staleTime: 10_000,
    });
  }

  return (
    <Link
      to={href}
      onMouseEnter={handleHover}
      className="group block bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
    >
      <div className="flex items-center gap-4">
        {player.image_url ? (
          <img
            src={player.image_url}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.style.display = "none";
            }}
            alt={player.name}
            loading="lazy"
            className="w-16 h-16 rounded-full object-cover bg-surface-overlay shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-surface-overlay shrink-0" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-text-primary truncate">{player.name}</h3>
            {renderStatus && (
              <PlayerStatusBadge
                status={player.status}
                title={player.status_description ?? undefined}
                size="sm"
              />
            )}
          </div>
          <p className="text-text-tertiary text-xs mt-1 tabular-nums">
            {player.jerseynum != null && <span>#{player.jerseynum}</span>}
            {player.jerseynum != null && player.position && <span> · </span>}
            {player.position && <span>{player.position}</span>}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function RosterGrid({ league, season, players, showStatus = true }) {
  if (!players || players.length === 0) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        No roster data for this season.
      </p>
    );
  }

  return (
    <m.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {players.map((player) => (
        <m.div key={player.id} variants={itemVariants} className="w-full">
          <RosterCard league={league} season={season} player={player} showStatus={showStatus} />
        </m.div>
      ))}
    </m.div>
  );
}
