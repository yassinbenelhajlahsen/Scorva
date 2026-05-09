import { Link } from "react-router-dom";

export default function PlayerCompactRow({
  rank,
  to,
  opponent,
  isHome,
  result,
  meta,
  value,
  onMouseEnter,
}) {
  const opponentName = opponent?.name || opponent?.abbreviation || "Opponent";
  const matchup = `${isHome ? "vs" : "@"} ${opponentName}`;

  return (
    <Link
      to={to}
      onMouseEnter={onMouseEnter}
      className="flex items-center gap-3 min-h-12 py-2 px-3 rounded-xl hover:bg-surface-overlay transition-all"
    >
      <span className="text-text-tertiary font-semibold text-xs w-5 tabular-nums shrink-0">
        {rank}
      </span>
      <img
        loading="lazy"
        src={opponent?.logo || "/defaultPhoto.webp"}
        alt=""
        className="w-7 h-7 object-contain shrink-0"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "/defaultPhoto.webp";
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-medium text-text-primary truncate">{matchup}</span>
          {result && <ResultPill result={result} />}
        </div>
        <div className="text-text-tertiary text-[11px] truncate">{meta}</div>
      </div>
      <span className="text-accent font-bold text-sm tabular-nums w-12 text-right shrink-0">
        {value}
      </span>
    </Link>
  );
}

function ResultPill({ result }) {
  const isWin = result === "W";
  return (
    <span
      className={`inline-flex items-center justify-center text-[9px] font-bold leading-none w-4 h-4 rounded-full shrink-0 ${
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
