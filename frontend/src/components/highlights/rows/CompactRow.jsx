import { Link } from "react-router-dom";

export default function CompactRow({ rank, to, imageUrl, name, meta, value, onMouseEnter, isLive = false }) {
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="flex items-center gap-3 min-h-12 py-2 px-3 rounded-xl hover:bg-surface-overlay transition-all"
    >
      <span className="text-text-tertiary font-semibold text-xs w-5 tabular-nums shrink-0">{rank}</span>
      <img
        loading="lazy"
        src={imageUrl || "/defaultPhoto.webp"}
        alt=""
        className="w-7 h-7 object-cover rounded-full shrink-0"
        onError={(e) => { e.target.onerror = null; e.target.src = "/defaultPhoto.webp"; }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-text-primary truncate">{name}</span>
          {isLive && <LivePill />}
        </div>
        <div className="text-text-tertiary text-[11px] truncate">{meta}</div>
      </div>
      <span className="text-accent font-bold text-sm tabular-nums w-12 text-right shrink-0">{value}</span>
    </Link>
  );
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-live/15 text-live ring-1 ring-live/30 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse" />
      LIVE
    </span>
  );
}
