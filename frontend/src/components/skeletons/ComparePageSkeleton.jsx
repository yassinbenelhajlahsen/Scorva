import Skeleton from "../ui/Skeleton.jsx";

export default function ComparePageSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-8 space-y-8">
      {/* Back link */}
      <Skeleton className="w-16 h-5 rounded" />

      {/* Hero card */}
      <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
        {/* Season selector */}
        <div className="flex justify-end mb-6">
          <Skeleton className="w-24 h-9 rounded-xl" />
        </div>

        {/* Player photos + VS */}
        <div className="flex items-center justify-center gap-6 sm:gap-25">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl" />
            <Skeleton className="w-24 h-5" />
            <Skeleton className="w-16 h-3" />
            <Skeleton className="w-20 h-3" />
          </div>
          <Skeleton className="w-10 h-8 rounded" />
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl" />
            <Skeleton className="w-24 h-5" />
            <Skeleton className="w-16 h-3" />
            <Skeleton className="w-20 h-3" />
          </div>
        </div>

        {/* Bio + Season Averages */}
        <div className="mt-8 pt-6 border-t border-white/[0.06]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <Skeleton className="w-10 h-4 mx-auto mb-10 rounded" />
              <div className="flex-1 flex flex-col justify-between gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center">
                    <Skeleton className="flex-1 h-4 rounded" />
                    <Skeleton className="w-16 h-3 mx-4 rounded" />
                    <Skeleton className="flex-1 h-4 rounded" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col">
              <Skeleton className="w-32 h-4 mx-auto mb-10 rounded" />
              <div className="flex-1 flex flex-col justify-between gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center">
                    <Skeleton className="flex-1 h-4 rounded" />
                    <Skeleton className="w-16 h-3 mx-4 rounded" />
                    <Skeleton className="flex-1 h-4 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Head-to-Head */}
      <div>
        <Skeleton className="w-28 h-5 mb-3" />
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-center gap-4 mb-5">
            <Skeleton className="w-12 h-10" />
            <Skeleton className="w-4 h-4" />
            <Skeleton className="w-12 h-10" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Recent Games */}
      <div>
        <Skeleton className="w-28 h-5 mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((col) => (
            <div key={col} className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="w-24 h-4" />
              </div>
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
