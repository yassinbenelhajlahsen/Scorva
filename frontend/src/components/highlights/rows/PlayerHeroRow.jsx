import { Link } from "react-router-dom";

const TIER_STYLES = {
  1: { height: "h-[88px]", number: "text-3xl", value: "text-3xl", img: "w-14 h-14", margin: "mb-3" },
  2: { height: "h-[72px]", number: "text-2xl", value: "text-2xl", img: "w-12 h-12", margin: "mb-2.5" },
  3: { height: "h-[64px]", number: "text-xl",  value: "text-xl",  img: "w-10 h-10", margin: "mb-2" },
};

export default function PlayerHeroRow({
  rank,
  color = "#e8863a",
  to,
  opponent,
  isHome,
  result,
  meta,
  value,
  onMouseEnter,
}) {
  const t = TIER_STYLES[rank] ?? TIER_STYLES[1];
  const opponentName = opponent?.name || opponent?.abbreviation || "Opponent";
  const matchup = `${isHome ? "vs" : "@"} ${opponentName}`;

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
      <span className={`text-accent font-black ${t.number} tabular-nums leading-none`}>
        #{rank}
      </span>
      <img
        loading="lazy"
        src={opponent?.logo || "/defaultPhoto.webp"}
        alt=""
        className={`${t.img} object-contain shrink-0`}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "/defaultPhoto.webp";
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-bold text-text-primary truncate">{matchup}</span>
          {result && <ResultPill result={result} />}
        </div>
        <div className="text-xs text-text-tertiary truncate">{meta}</div>
      </div>
      <span className={`text-accent font-black ${t.value} tabular-nums leading-none shrink-0`}>
        {value}
      </span>
    </Link>
  );
}

function ResultPill({ result }) {
  const isWin = result === "W";
  return (
    <span
      className={`inline-flex items-center justify-center text-[10px] font-bold leading-none w-5 h-5 rounded-full shrink-0 ${
        isWin
          ? "bg-win/15 text-win ring-1 ring-win/30"
          : "bg-loss/15 text-loss ring-1 ring-loss/30"
      }`}
      aria-label={isWin ? "Win" : "Loss"}
    >
      {result}
    </span>
  );
}
