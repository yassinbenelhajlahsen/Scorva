import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { m } from "framer-motion";
import slugify from "../../utils/slugify.js";
import { queryKeys, queryFns } from "../../lib/query.js";
import { getPeriodLabel } from "../../utils/formatDate.js";

function liveClockLabel(currentPeriod, clock, status, league) {
  if (status?.includes("Halftime")) return "Halftime";
  const period = getPeriodLabel(currentPeriod, league);
  if (!period) return null;
  if (status?.includes("End of Period") || (clock != null && parseFloat(clock) === 0)) {
    return `End ${period}`;
  }
  if (!clock) return period;
  return `${period} ${clock}`;
}

export default function StatCard({
  stats = [],
  opponent,
  date,
  gameId,
  league,
  isHome,
  opponentLogo,
  result,
  status,
  playerName,
  gameType = "regular",
  gameLabel,
  ratingGrade,
  homeScore,
  awayScore,
  currentPeriod,
  clock,
}) {
  const isFinal = status?.includes("Final");
  const inProgress =
    status?.includes("In Progress") ||
    status?.includes("Halftime") ||
    status?.includes("End of Period");
  const queryClient = useQueryClient();

  const teamScore = isHome ? homeScore : awayScore;
  const opponentScore = isHome ? awayScore : homeScore;
  const hasLiveScore =
    inProgress && teamScore != null && opponentScore != null;
  const periodClock = inProgress
    ? liveClockLabel(currentPeriod, clock, status, league)
    : null;

  const isPlayoff = gameType === "playoff" || gameType === "final";
  const isChampionship = gameType === "final";

  if (!stats.length) {
    return (
      <div className="bg-surface-elevated border border-white/[0.08] text-text-primary rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] w-full max-w-3xl p-6 text-center">
        <p className="text-text-tertiary text-sm">No stats available.</p>
      </div>
    );
  }

  const to = `/${league}/games/${gameId}?tab=analysis#${slugify(playerName)}`;

  return (
    <Link
      to={to}
      className="group block"
      onMouseEnter={() => {
        if (window.matchMedia("(hover: hover)").matches) {
          queryClient.prefetchQuery({
            queryKey: queryKeys.game(league, gameId),
            queryFn: queryFns.game(league, gameId),
            staleTime: 10_000,
          });
        }
      }}
    >
      <div className="relative bg-surface-elevated border border-white/[0.08] p-5 text-center mb-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 hover:z-10 cursor-pointer max-w-sm mx-auto overflow-hidden">

        {ratingGrade != null && (
          <div className="absolute top-3 left-3 flex flex-col items-start">
            <span className="text-[9px] uppercase tracking-widest text-text-tertiary font-medium">Rating</span>
            <span className="text-accent font-bold text-2xl tabular-nums leading-none">
              {ratingGrade.toFixed(1)}
            </span>
          </div>
        )}

        {/* Game info */}
        {(opponent || date) && (
          <div className="text-text-tertiary text-xs mb-4 text-center flex items-center justify-center gap-2">
            {inProgress && (
              <m.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="text-[10px] font-semibold uppercase tracking-widest text-live bg-live/10 px-2 py-0.5 rounded-full"
              >
                Live
              </m.span>
            )}
            {isFinal && result && (
              <span
                className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  result === "W"
                    ? "text-win bg-win/10"
                    : "text-loss bg-loss/10"
                }`}
              >
                {result}
              </span>
            )}
            <span className="flex items-center gap-1 text-text-secondary text-xs">
              {isHome ? "vs." : "@"}
              {opponentLogo && (
                <img
                  src={opponentLogo}
                  alt={`${opponent} logo`}
                  className="w-4 h-4 object-contain mx-1"
                />
              )}
              {opponent}
              {hasLiveScore ? (
                <>
                  <span aria-hidden> · </span>
                  <span className="font-bold tabular-nums text-text-primary">
                    {teamScore}-{opponentScore}
                  </span>
                </>
              ) : (
                date && <> · {date}</>
              )}
              {periodClock && (
                <>
                  <span aria-hidden> · </span>
                  <span className="text-live/80 font-medium tabular-nums">
                    {periodClock}
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        <ul className="flex flex-wrap justify-center gap-8 max-h-[500px] [@media(hover:hover)]:max-h-18 [@media(hover:hover)]:group-hover:max-h-[500px] overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
          {stats.map((stat, i) => (
            <li key={i} className="flex flex-col items-center min-w-[52px]">
              <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">{stat.label}</span>
              <span className="font-semibold text-2xl mt-1 text-text-primary">
                {stat.value}
                {stat.label.includes("%") && "%"}
              </span>
            </li>
          ))}
        </ul>

        {isPlayoff && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-center gap-2">
            <span className="text-xs text-text-tertiary font-medium tracking-wide">
              {gameLabel || (isChampionship ? "Finals" : "Playoffs")}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
