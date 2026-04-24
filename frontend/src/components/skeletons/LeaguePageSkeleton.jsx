import Skeleton from "../ui/Skeleton.jsx";
import GameCardSkeleton from "./GameCardSkeleton.jsx";
import PlayoffsSkeleton from "./PlayoffsSkeleton.jsx";

function GamePillSkeleton() {
  return (
    <div className="flex-1 min-w-fit inline-flex items-center justify-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
      <div className="flex items-center gap-1.5 pr-3 border-r border-white/[0.08]">
        <Skeleton className="h-2.5 w-8 rounded" />
      </div>
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-3 w-14 rounded" />
        <Skeleton className="h-3 w-5 rounded" />
      </div>
      <span className="text-text-tertiary text-xs">·</span>
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-3 w-14 rounded" />
        <Skeleton className="h-3 w-5 rounded" />
      </div>
    </div>
  );
}

export function LeagueSlateSkeleton() {
  return (
    <div className="mb-5 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-2 pb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <GamePillSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

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
