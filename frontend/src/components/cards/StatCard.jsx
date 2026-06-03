import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
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
  const [isExpanded, setIsExpanded] = useState(false);
  const isFinal = status?.includes("Final");
  const inProgress =
    status?.includes("In Progress") ||
    status?.includes("Halftime") ||
    status?.includes("End of Period");
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOtherExpand = (e) => {
      if (e.detail.id !== gameId) setIsExpanded(false);
    };
    window.addEventListener("statcard:expand", handleOtherExpand);
    return () => window.removeEventListener("statcard:expand", handleOtherExpand);
  }, [gameId]);

  const teamScore = isHome ? homeScore : awayScore;
  const opponentScore = isHome ? awayScore : homeScore;
  const hasLiveScore =
    inProgress && teamScore != null && opponentScore != null;
  const periodClock = inProgress
    ? liveClockLabel(currentPeriod, clock, status, league)
    : null;

  const isPlayoff = gameType === "playoff" || gameType === "final";
  const isChampionship = gameType === "final";
  const rail = isChampionship
    ? "w-[3px] bg-accent"
    : isPlayoff
      ? "w-[2px] bg-accent/70 group-hover:bg-accent transition-colors duration-200"
      : result === "W"
        ? "w-[2px] bg-win/60 group-hover:bg-win transition-colors duration-200"
        : "w-[2px] bg-loss/60 group-hover:bg-loss transition-colors duration-200";

  if (!stats.length) {
    return (
      <div className="relative pl-4 text-text-primary w-full max-w-3xl p-6 text-center">
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/15 rounded-full" />
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
      <div className="group relative transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer max-w-sm mx-auto hover:bg-white/[0.04] hover:-translate-y-0.5">
        <div className={`absolute left-0 top-0 bottom-0 ${rail}`} />
        <div className="absolute inset-0 bg-gradient-to-r from-accent/[0.05] to-transparent pointer-events-none" />
        <div className="relative flex items-stretch">
        <div className="flex-1 min-w-0 p-5 text-center">

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

        <ul
          className={`flex flex-wrap justify-center gap-8 max-h-18 overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)]:group-hover:max-h-[500px] ${
            isExpanded ? "[@media(hover:none)]:max-h-[500px]" : ""
          }`}
        >
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

        {isPlayoff && gameLabel && (
          <div className={`mt-3 pt-3 border-t ${isChampionship ? "border-accent/30" : "border-white/[0.06]"} flex items-center justify-center gap-1.5`}>
            <span className={`tracking-wide ${isChampionship ? "text-accent font-semibold uppercase tracking-[0.15em] text-[11px]" : "text-xs text-text-tertiary font-medium"}`}>
              {gameLabel}
            </span>
          </div>
        )}

        {/* Mobile-only expand button — desktop uses hover instead. */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded((v) => {
              const next = !v;
              if (next) {
                window.dispatchEvent(
                  new CustomEvent("statcard:expand", { detail: { id: gameId } }),
                );
              }
              return next;
            });
          }}
          aria-label={isExpanded ? "Hide stat breakdown" : "Show stat breakdown"}
          className="touch-target [@media(hover:hover)]:!hidden mt-3 mx-auto inline-flex items-center gap-1 text-[11px] text-text-tertiary transition-colors duration-150 active:text-text-secondary"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
          {isExpanded ? "Hide" : "Breakdown"}
        </button>
        </div>

        {ratingGrade != null && (
          <div className="shrink-0 px-3.5 py-3 flex flex-col items-center justify-center">
            <span className="text-accent font-bold text-3xl tabular-nums leading-none">
              {ratingGrade.toFixed(1)}
            </span>
            <span className="text-[9px] uppercase tracking-widest text-text-tertiary mt-1.5 font-medium">
              Rating
            </span>
          </div>
        )}
        </div>
      </div>
    </Link>
  );
}
