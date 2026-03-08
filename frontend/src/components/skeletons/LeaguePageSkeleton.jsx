import Skeleton from "../ui/Skeleton.jsx";
import GameCardSkeleton from "./GameCardSkeleton.jsx";

function StandingsColumnSkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-40 mx-auto mb-4" />
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-5 py-3 ${
              i < 14 ? "border-b border-white/[0.04]" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-5 h-3 rounded" />
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeaguePageSkeleton() {
  return (
    <>
      {/* Standings */}
      <div className="mb-20">
        <Skeleton className="h-6 w-32 mx-auto mb-10 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <StandingsColumnSkeleton />
          <StandingsColumnSkeleton />
        </div>
      </div>

      {/* Games */}
      <div>
        <Skeleton className="h-6 w-24 mx-auto mb-10 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 justify-items-center items-start">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-full">
              <GameCardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
