import Skeleton from "../ui/Skeleton.jsx";

function TopPerformerSkeleton() {
  return (
    <div className="flex items-center gap-4 bg-surface-elevated border border-white/[0.08] p-4 rounded-2xl">
      <Skeleton className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function TeamSideSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <Skeleton className="w-20 h-20 sm:w-28 sm:h-28 rounded-full" />
      <div className="flex flex-col items-center sm:items-start gap-2">
        <Skeleton className="h-6 w-20 sm:h-8 sm:w-28 rounded-xl" />
        <Skeleton className="h-8 w-16 sm:h-12 sm:w-20 rounded-xl" />
      </div>
    </div>
  );
}

export default function GamePageSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <Skeleton className="h-4 w-24 mb-8" />

      {/* Matchup header */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 mb-10">
        <TeamSideSkeleton />
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-4 w-6" />
        </div>
        <TeamSideSkeleton />
      </div>

      {/* Game info + top performers */}
      <div className="flex flex-col lg:flex-row gap-6 mb-10">
        {/* Game info card */}
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] shrink-0">
          <div className="grid grid-cols-[max-content_auto] gap-x-8 gap-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <>
                <Skeleton key={`l${i}`} className="h-3 w-16" />
                <Skeleton key={`v${i}`} className="h-3 w-40" />
              </>
            ))}
          </div>
        </div>

        {/* Top performer cards */}
        <div className="flex-1 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <TopPerformerSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Quarter-by-quarter */}
      <div className="max-w-2xl mx-auto mb-2">
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
