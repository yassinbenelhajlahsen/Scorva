import { Link } from "react-router-dom";

export default function GameCompactRow({ rank, to, homeTeam, awayTeam, score, tierLabel, value, onMouseEnter, isLive }) {
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:bg-surface-overlay hover:border-white/[0.08] transition-all duration-[200ms] no-underline"
    >
      <span className="w-6 text-right text-xs font-semibold text-text-tertiary tabular-nums">{rank}</span>
      <div className="flex items-center gap-1 shrink-0">
        {homeTeam?.logo && <img src={homeTeam.logo} alt="" loading="lazy" className="w-6 h-6 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
        {awayTeam?.logo && <img src={awayTeam.logo} alt="" loading="lazy" className="w-6 h-6 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary truncate">
          {homeTeam?.abbr} <span className="text-text-tertiary">vs</span> {awayTeam?.abbr}
        </span>
        {isLive && <span className="text-[9px] uppercase tracking-widest font-semibold text-live">Live</span>}
      </div>
      <span className="text-xs text-text-tertiary truncate hidden sm:inline">
        {score}{tierLabel ? ` · ${tierLabel}` : ""}
      </span>
      <span className="text-sm font-bold tabular-nums text-accent">
        <span aria-hidden="true">★</span> {value}
      </span>
    </Link>
  );
}
