import Skeleton from "../ui/Skeleton.jsx";

function TopPerformerSkeleton() {
  return (
    <div className="flex items-stretch bg-surface-elevated border border-white/[0.08] rounded-2xl h-[108px] overflow-hidden">
      {/* Left slab */}
      <div className="w-[88px] shrink-0 bg-white/[0.03] border-r border-white/[0.05] flex flex-col items-center justify-center gap-2">
        <Skeleton className="w-12 h-12 rounded-full" />
        <Skeleton className="h-2 w-14" />
      </div>
      {/* Right zone */}
      <div className="flex-1 flex flex-col justify-between px-3.5 py-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-2.5 w-16" />
        </div>
        <div className="flex gap-3.5">
          <Skeleton className="h-4 w-7" />
          <Skeleton className="h-4 w-7" />
          <Skeleton className="h-4 w-7" />
        </div>
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

      {/* Game info + Quarter scores */}
      <div className="grid grid-cols-1 lg:grid-cols-[32.5%_1fr] gap-4 mb-6">
        {/* Game info — compact */}
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col">
          <div className="flex flex-col justify-between h-full gap-2">
            {["Date", "Status", "Location", "Broadcast"].map((label) => (
              <div key={label} className="flex items-baseline gap-3">
                <Skeleton className="h-3 w-14 shrink-0" />
                <Skeleton className={`h-3 ${label === "Location" ? "w-28" : label === "Date" ? "w-24" : "w-16"}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Quarter scores */}
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          {/* Header row */}
          <div className="flex items-center gap-x-2 pb-2 border-b border-white/[0.06]">
            <Skeleton className="h-3 flex-1" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-9 shrink-0" />
            ))}
          </div>
          {/* Home row */}
          <div className="flex items-center gap-x-2 pt-2.5 pb-1.5">
            <Skeleton className="h-3.5 flex-1" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 w-9 shrink-0" />
            ))}
          </div>
          <div className="border-t border-white/[0.04]" />
          {/* Away row */}
          <div className="flex items-center gap-x-2 pt-1.5">
            <Skeleton className="h-3.5 flex-1" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3.5 w-9 shrink-0" />
            ))}
          </div>
        </div>
      </div>

      {/* Top performer cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <TopPerformerSkeleton key={i} />
        ))}
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
