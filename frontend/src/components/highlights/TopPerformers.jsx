import { Link } from "react-router-dom";
import { useTopPerformances } from "../../hooks/data/useTopPerformances.js";
import TopPerformersSkeleton from "../skeletons/TopPerformersSkeleton.jsx";

export default function TopPerformers({ league = "nba", mode = "games" }) {
  const { data, isLoading } = useTopPerformances(league, { type: mode, days: 7, limit: 25 });

  if (isLoading) return <TopPerformersSkeleton />;
  if (!data?.performances?.length) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        No top performances yet.
      </p>
    );
  }

  const items = data.performances;
  const hero = items[0];
  const rest = items.slice(1);

  return (
    <ul className="flex flex-col gap-1">
      <li>
        <HeroRow item={hero} mode={mode} league={league} />
      </li>
      {rest.map((it, idx) => (
        <li key={(it.player?.id || idx) + ":" + (it.game?.id || "")}>
          <CompactRow item={it} rank={idx + 2} mode={mode} league={league} />
        </li>
      ))}
    </ul>
  );
}

function HeroRow({ item, mode, league }) {
  const color = item.player?.team?.primary_color || "#e8863a";
  const to = mode === "games"
    ? `/${league}/games/${item.game.id}`
    : `/${league}/players/${item.player.slug || item.player.id}`;
  const meta = mode === "games"
    ? `${item.stats.points}/${item.stats.rebounds}/${item.stats.assists}  ·  ${item.game.isHome ? "vs" : "@"} ${item.game.opponent.abbreviation}${item.game.date ? ` · ${formatDate(item.game.date)}` : ""}`
    : `${item.gamesPlayed} GP · avg ${item.avgPerGame.toFixed(1)}`;
  const value = mode === "games" ? item.ratingGrade.toFixed(1) : item.totalRating.toFixed(1);
  return (
    <Link
      to={to}
      className="relative flex items-center gap-4 h-[88px] px-5 rounded-2xl mb-3 cursor-pointer overflow-hidden hover:brightness-110 transition-all"
      style={{
        background: `linear-gradient(135deg, ${color}33 0%, ${color}11 60%, transparent 100%)`,
        border: `1px solid ${color}40`,
      }}
    >
      <span className="text-accent font-black text-3xl tabular-nums leading-none">#1</span>
      <img
        loading="lazy"
        src={item.player.imageUrl || "/defaultPhoto.webp"}
        alt={item.player.name}
        className="w-14 h-14 object-cover rounded-full ring-2 ring-accent/40 shrink-0"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "/defaultPhoto.webp";
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-base font-bold text-text-primary truncate">{item.player.name}</div>
        <div className="text-xs text-text-tertiary truncate">{meta}</div>
      </div>
      <span className="text-accent font-black text-3xl tabular-nums leading-none shrink-0">{value}</span>
    </Link>
  );
}

function CompactRow({ item, rank, mode, league }) {
  const to = mode === "games"
    ? `/${league}/games/${item.game.id}`
    : `/${league}/players/${item.player.slug || item.player.id}`;
  const value = mode === "games" ? item.ratingGrade.toFixed(1) : item.totalRating.toFixed(1);
  const meta = mode === "games"
    ? `${item.stats.points}/${item.stats.rebounds}/${item.stats.assists}`
    : `${item.gamesPlayed} GP`;
  return (
    <Link
      to={to}
      className="flex items-center gap-3 h-12 px-3 rounded-xl hover:bg-surface-overlay transition-all"
    >
      <span className="text-text-tertiary font-semibold text-xs w-5 tabular-nums">{rank}</span>
      <img
        loading="lazy"
        src={item.player.imageUrl || "/defaultPhoto.webp"}
        alt=""
        className="w-7 h-7 object-cover rounded-full shrink-0"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "/defaultPhoto.webp";
        }}
      />
      <span className="text-sm font-medium text-text-primary flex-1 truncate">{item.player.name}</span>
      <span className="text-text-tertiary text-[11px] tabular-nums">{meta}</span>
      <span className="text-accent font-bold text-sm tabular-nums w-12 text-right">{value}</span>
    </Link>
  );
}

function formatDate(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
