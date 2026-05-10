import { Link } from "react-router-dom";
import { m } from "framer-motion";
import { getPeriodLabel } from "../../utils/formatDate.js";

function clockLabel(currentPeriod, clock, status, league) {
  if (status?.includes("Halftime")) return "Halftime";
  const period = getPeriodLabel(currentPeriod, league);
  if (!period) return null;
  if (status?.includes("End of Period") || (clock != null && parseFloat(clock) === 0)) {
    return `End ${period}`;
  }
  if (!clock) return period;
  return `${period} ${clock}`;
}

export default function LiveGameCard({ league, game }) {
  if (!game) return null;
  const {
    id,
    isHome,
    opponent,
    teamScore,
    opponentScore,
    status,
    currentPeriod,
    clock,
  } = game;
  if (!opponent) return null;

  const periodClock = clockLabel(currentPeriod, clock, status, league);
  const score =
    teamScore != null && opponentScore != null
      ? `${teamScore} - ${opponentScore}`
      : null;

  return (
    <Link
      to={`/${league}/games/${id}`}
      className="group inline-flex items-center gap-2.5 bg-surface-elevated/60 hover:bg-surface-overlay border border-live/25 hover:border-live/40 rounded-xl pl-2 pr-3 py-1.5 transition-all duration-200 no-underline"
      aria-label={`Live: ${isHome ? "vs" : "@"} ${opponent.shortname}${score ? `, score ${score}` : ""}${periodClock ? `, ${periodClock}` : ""}`}
    >
      <m.span
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="text-[10px] font-semibold uppercase tracking-[0.18em] text-live bg-live/10 px-2 py-0.5 rounded-full"
      >
        Live
      </m.span>
      <span className="text-xs font-semibold text-text-secondary">
        {isHome ? "vs" : "@"}
      </span>
      {opponent.logoUrl && (
        <img
          src={opponent.logoUrl}
          alt=""
          className="w-5 h-5 object-contain shrink-0"
        />
      )}
      <span className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors duration-200">
        {opponent.shortname}
      </span>
      {score && (
        <>
          <span aria-hidden className="text-text-tertiary">·</span>
          <span className="text-xs font-bold text-text-primary tabular-nums">
            {score}
          </span>
        </>
      )}
      {periodClock && (
        <>
          <span aria-hidden className="text-text-tertiary">·</span>
          <span className="text-[11px] text-live/80 font-medium tabular-nums">
            {periodClock}
          </span>
        </>
      )}
    </Link>
  );
}
