import { Link } from "react-router-dom";

const TIER_STYLES = {
  1: { height: "h-[88px]", number: "text-3xl", value: "text-3xl", img: "w-14 h-14 ring-2", margin: "mb-3" },
  2: { height: "h-[72px]", number: "text-2xl", value: "text-2xl", img: "w-12 h-12 ring-2", margin: "mb-2.5" },
  3: { height: "h-[64px]", number: "text-xl",  value: "text-xl",  img: "w-10 h-10 ring-1", margin: "mb-2" },
};

export default function HeroRow({ rank, color = "#e8863a", to, imageUrl, name, meta, value, onMouseEnter }) {
  const t = TIER_STYLES[rank] ?? TIER_STYLES[1];
  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className={`relative flex items-center gap-4 ${t.height} px-5 rounded-2xl ${t.margin} cursor-pointer overflow-hidden hover:brightness-110 transition-all`}
      style={{
        background: `linear-gradient(135deg, ${color}33 0%, ${color}11 60%, transparent 100%)`,
        border: `1px solid ${color}40`,
      }}
    >
      <span className={`text-accent font-black ${t.number} tabular-nums leading-none`}>#{rank}</span>
      <img
        loading="lazy"
        src={imageUrl || "/defaultPhoto.webp"}
        alt={name}
        className={`${t.img} object-cover rounded-full ring-accent/40 shrink-0`}
        onError={(e) => { e.target.onerror = null; e.target.src = "/defaultPhoto.webp"; }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-text-primary truncate">{name}</div>
        <div className="text-xs text-text-tertiary truncate">{meta}</div>
      </div>
      <span className={`text-accent font-black ${t.value} tabular-nums leading-none shrink-0`}>{value}</span>
    </Link>
  );
}
