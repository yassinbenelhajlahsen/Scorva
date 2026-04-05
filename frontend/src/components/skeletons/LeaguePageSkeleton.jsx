import Skeleton from "../ui/Skeleton.jsx";
import GameCardSkeleton from "./GameCardSkeleton.jsx";

function StandingsColumnSkeleton() {
  return (
    <div>
      <div className="flex justify-center mb-4">
        <Skeleton className="h-3.5 w-36 rounded" />
      </div>
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

export default function LeaguePageSkeleton({ activeTab = "games" }) {
  if (activeTab === "standings") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <StandingsColumnSkeleton />
        <StandingsColumnSkeleton />
      </div>
    );
  }

  return (
    <>
      {/* Date navigator */}
      <div className="bg-surface-elevated border border-white/[0.07] rounded-2xl mb-8">
        {/* Header row */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/[0.05]">
          <Skeleton className="h-3.5 w-20 rounded" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
        </div>

        {/* Strip row */}
        <div className="px-2 py-2">
          <div className="flex items-center gap-1.5">
            <Skeleton className="flex-shrink-0 h-7 w-7 rounded-full" />
            <div className="flex flex-1 min-w-0">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1">
                  <Skeleton className="h-2.5 w-6 rounded" />
                  <Skeleton className="h-3.5 w-8 rounded" />
                  <Skeleton className="h-2 w-3 rounded" />
                </div>
              ))}
            </div>
            <Skeleton className="flex-shrink-0 h-7 w-7 rounded-full" />
          </div>
        </div>
      </div>

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
