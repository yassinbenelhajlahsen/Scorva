import { Link } from "react-router-dom";
import { formatDateShort } from "../../utils/formatDate.js";
import { displayStartTime } from "../../utils/slateDate.js";

export default function NextGameCard({ league, game }) {
  if (!game) return null;
  const { id, isHome, opponent, date, startTime } = game;
  if (!opponent) return null;

  return (
    <Link
      to={`/${league}/games/${id}`}
      className="group inline-flex items-center gap-2.5 bg-surface-elevated/60 hover:bg-surface-overlay border border-white/[0.06] hover:border-white/[0.12] rounded-xl pl-2 pr-3 py-1.5 transition-all duration-200 no-underline"
      aria-label={`Next game: ${isHome ? "vs" : "@"} ${opponent.shortname} on ${formatDateShort(date)}`}
    >
      <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-text-tertiary">
        Next
      </span>
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
      <span aria-hidden className="text-text-tertiary">·</span>
      <span className="text-[11px] text-text-tertiary tabular-nums">
        {formatDateShort(date)}
        {startTime ? ` · ${displayStartTime(startTime)}` : ""}
      </span>
    </Link>
  );
}
