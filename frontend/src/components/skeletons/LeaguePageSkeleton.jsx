import Skeleton from "../ui/Skeleton.jsx";
import GameCardSkeleton from "./GameCardSkeleton.jsx";
import PlayoffsSkeleton from "./PlayoffsSkeleton.jsx";

function StandingsColumnSkeleton({ heading }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-4 text-center">
        {heading}
      </h3>
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`flex justify-between items-center px-5 py-3 ${i < 7 ? "border-b border-white/[0.04]" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="w-5 text-right text-text-tertiary text-xs tabular-nums">{i + 1}</span>
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3.5 w-28 rounded" />
            </div>
            <Skeleton className="h-3.5 w-10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeaguePageSkeleton({ activeTab = "games", league, season }) {
  if (activeTab === "playoffs") {
    return <PlayoffsSkeleton season={season} />;
  }
  if (activeTab === "standings") {
    const isNFL = league === "nfl";
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <StandingsColumnSkeleton heading={isNFL ? "AFC" : "Eastern Conference"} />
        <StandingsColumnSkeleton heading={isNFL ? "NFC" : "Western Conference"} />
      </div>
    );
  }

  return (
    <>
      {/* Games grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 justify-items-center items-start">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-full">
            <GameCardSkeleton />
          </div>
        ))}
      </div>
    </>
  );
}
