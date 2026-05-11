import { Link } from "react-router-dom";

export default function TeamHeroRow({ rank, to, color, logo, name, abbr, meta, value, onMouseEnter, isLive }) {
  const gradient = color
    ? `linear-gradient(110deg, ${hexToRgba(color, 0.45)} 0%, ${hexToRgba(color, 0.12)} 60%, transparent 100%)`
    : undefined;
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="relative block rounded-2xl border border-white/[0.08] bg-surface-elevated px-4 py-3 transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 no-underline"
      style={gradient ? { backgroundImage: gradient } : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-base/60 backdrop-blur-sm text-sm font-bold text-text-primary">
          {rank}
        </span>
        {logo && (
          <img src={logo} alt="" loading="lazy" className="w-12 h-12 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary truncate">{name}</span>
            {abbr && <span className="text-xs text-text-tertiary">{abbr}</span>}
            {isLive && <span className="text-[9px] uppercase tracking-widest font-semibold text-live bg-live/10 px-1.5 py-0.5 rounded-full">Live</span>}
          </div>
          {meta && <p className="text-xs text-text-tertiary truncate">{meta}</p>}
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-base/60 backdrop-blur-sm border border-white/[0.1] text-sm font-bold tabular-nums text-accent">
          <span aria-hidden="true">★</span>
          {value}
        </span>
      </div>
    </Link>
  );
}

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return `rgba(255,255,255,${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
