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
  const [firstName, ...rest] = player.name.split(" ");
  const lastName = rest.join(" ");

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
      className="group relative block overflow-hidden bg-surface-elevated border border-white/[0.08] rounded-2xl transition-all duration-[300ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.16] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.45)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
    >
      {/* Oversized jersey number as background graphic */}
      {player.jerseynum != null && (
        <span
          aria-hidden="true"
          className="absolute -top-3 -right-1 text-[96px] font-black tracking-[-0.04em] text-white/[0.04] group-hover:text-accent/[0.14] transition-colors duration-[300ms] tabular-nums leading-none select-none pointer-events-none"
        >
          {player.jerseynum}
        </span>
      )}

      <div className="relative flex items-center gap-4 p-5">
        {player.image_url ? (
          <div className="relative shrink-0">
            <img
              src={player.image_url}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.style.display = "none";
              }}
              alt={player.name}
              loading="lazy"
              className="w-20 h-20 rounded-full object-cover bg-surface-overlay ring-1 ring-white/[0.06] group-hover:ring-white/[0.18] transition-all duration-[300ms]"
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-surface-overlay ring-1 ring-white/[0.06] shrink-0" aria-hidden="true" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-medium text-text-tertiary tracking-wide truncate">
              {firstName}
            </span>
            <h3 className="text-[17px] font-semibold text-text-primary tracking-tight truncate">
              {lastName || firstName}
            </h3>
          </div>

          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {player.position && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.06] text-text-secondary text-[10px] font-semibold uppercase tracking-[0.08em]">
                {player.position}
              </span>
            )}
            {renderStatus && (
              <PlayerStatusBadge
                status={player.status}
                title={player.status_description ?? undefined}
                size="sm"
              />
            )}
          </div>
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
