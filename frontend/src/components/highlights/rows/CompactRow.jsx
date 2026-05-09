import { Link } from "react-router-dom";

export default function CompactRow({ rank, to, imageUrl, name, meta, value, onMouseEnter }) {
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
        <div className="text-sm font-medium text-text-primary truncate">{name}</div>
        <div className="text-text-tertiary text-[11px] truncate">{meta}</div>
      </div>
      <span className="text-accent font-bold text-sm tabular-nums w-12 text-right shrink-0">{value}</span>
    </Link>
  );
}
