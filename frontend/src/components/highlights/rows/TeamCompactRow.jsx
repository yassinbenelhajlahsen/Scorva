import { Link } from "react-router-dom";

export default function TeamCompactRow({ rank, to, logo, name, abbr, meta, value, onMouseEnter, isLive }) {
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:bg-surface-overlay hover:border-white/[0.08] transition-all duration-[200ms] no-underline"
    >
      <span className="w-6 text-right text-xs font-semibold text-text-tertiary tabular-nums">{rank}</span>
      {logo && <img src={logo} alt="" loading="lazy" className="w-7 h-7 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary truncate">{name}</span>
        {abbr && <span className="text-[11px] text-text-tertiary">{abbr}</span>}
        {isLive && <span className="text-[9px] uppercase tracking-widest font-semibold text-live">Live</span>}
      </div>
      {meta && <span className="text-xs text-text-tertiary truncate hidden sm:inline">{meta}</span>}
      <span className="text-sm font-bold tabular-nums text-accent">
        <span aria-hidden="true">★</span> {value}
      </span>
    </Link>
  );
}
