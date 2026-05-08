import { useState } from "react";
import { Link } from "react-router-dom";
import { useTopPerformances } from "../../hooks/data/useTopPerformances.js";
import TopPerformancesCardSkeleton from "../skeletons/TopPerformancesCardSkeleton.jsx";

const TABS = [
  { id: "games",      label: "Best Games" },
  { id: "cumulative", label: "Last 7 Days" },
];

export default function TopPerformancesCard({ league = "nba" }) {
  const [tab, setTab] = useState("games");
  const { data, isLoading } = useTopPerformances(league, { type: tab, days: 7, limit: 5 });

  if (isLoading) return <TopPerformancesCardSkeleton />;
  if (!data?.performances?.length) return null;

  const items = data.performances;
  const hero = items[0];
  const rest = items.slice(1);

  return (
    <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 max-w-[1200px] mx-auto my-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs uppercase tracking-widest text-text-tertiary font-semibold">Top Performances</h3>
        <span className="text-[10px] text-text-tertiary">Last 7 Days</span>
      </div>
      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs uppercase tracking-widest font-semibold rounded-full transition-all duration-200 ${
              tab === t.id ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <HeroRow item={hero} tab={tab} league={league} />
      <ul className="flex flex-col gap-1">
        {rest.map((it, idx) => (
          <CompactRow
            key={(it.player?.id || idx) + ":" + (it.game?.id || "")}
            item={it}
            rank={idx + 2}
            tab={tab}
            league={league}
          />
        ))}
      </ul>
    </div>
  );
}

function HeroRow({ item, tab, league }) {
  const color = item.player?.team?.primary_color || "#e8863a";
  const to = tab === "games"
    ? `/${league}/games/${item.game.id}`
    : `/${league}/players/${item.player.slug || item.player.id}`;
  const meta = tab === "games"
    ? `${item.stats.points}/${item.stats.rebounds}/${item.stats.assists}  ·  ${item.game.isHome ? "vs" : "@"} ${item.game.opponent.abbreviation}${item.game.date ? ` · ${formatDate(item.game.date)}` : ""}`
    : `${item.gamesPlayed} GP · avg ${item.avgPerGame.toFixed(1)}`;
  const value = tab === "games" ? item.ratingGrade.toFixed(1) : item.totalRating.toFixed(1);
  return (
    <Link
      to={to}
      className="relative flex items-center gap-4 px-5 py-4 rounded-2xl mb-3 cursor-pointer overflow-hidden hover:brightness-110 transition-all"
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

function CompactRow({ item, rank, tab, league }) {
  const to = tab === "games"
    ? `/${league}/games/${item.game.id}`
    : `/${league}/players/${item.player.slug || item.player.id}`;
  const value = tab === "games" ? item.ratingGrade.toFixed(1) : item.totalRating.toFixed(1);
  const meta = tab === "games"
    ? `${item.stats.points}/${item.stats.rebounds}/${item.stats.assists}`
    : `${item.gamesPlayed} GP`;
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-overlay transition-all">
        <span className="text-text-tertiary font-semibold text-xs w-4 tabular-nums">{rank}</span>
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
    </li>
  );
}

function formatDate(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
