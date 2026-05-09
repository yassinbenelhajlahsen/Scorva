import { Link } from "react-router-dom";

export default function CompactRow({ rank, to, imageUrl, name, meta, value, onMouseEnter }) {
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="flex items-center gap-3 h-12 px-3 rounded-xl hover:bg-surface-overlay transition-all"
    >
      <span className="text-text-tertiary font-semibold text-xs w-5 tabular-nums">{rank}</span>
      <img
        loading="lazy"
        src={imageUrl || "/defaultPhoto.webp"}
        alt=""
        className="w-7 h-7 object-cover rounded-full shrink-0"
        onError={(e) => { e.target.onerror = null; e.target.src = "/defaultPhoto.webp"; }}
      />
      <span className="text-sm font-medium text-text-primary flex-1 truncate">{name}</span>
      <span className="text-text-tertiary text-[11px] tabular-nums">{meta}</span>
      <span className="text-accent font-bold text-sm tabular-nums w-12 text-right">{value}</span>
    </Link>
  );
}
