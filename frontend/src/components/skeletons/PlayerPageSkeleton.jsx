import Skeleton from "../ui/Skeleton.jsx";

function StatCardSkeleton() {
  return (
    <div className="bg-surface-elevated border border-white/[0.08] p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>
      <div className="flex flex-wrap justify-center gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-2.5 w-8" />
            <Skeleton className="h-8 w-12 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlayerPageSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <Skeleton className="h-4 w-20 mb-8" />

      {/* Player header */}
      <div className="flex flex-col md:flex-row gap-8 mb-12">
        {/* Headshot + name */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <Skeleton className="h-8 w-40 rounded-xl" />
          <Skeleton className="w-56 h-56 rounded-3xl" />
        </div>

        {/* Info card + averages */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex justify-end">
            <Skeleton className="h-9 w-36 rounded-full" />
          </div>

          {/* Info card */}
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="grid grid-cols-[max-content_auto] gap-x-10 gap-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <>
                  <Skeleton key={`l${i}`} className="h-3 w-24" />
                  <Skeleton key={`v${i}`} className="h-3 w-32" />
                </>
              ))}
            </div>
          </div>

          {/* Season averages card */}
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
            <Skeleton className="h-9 w-full rounded-none" />
            <div className="p-6">
              <div className="flex flex-wrap gap-y-6 gap-x-10 justify-center">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 min-w-[72px]">
                    <Skeleton className="h-2.5 w-10" />
                    <Skeleton className="h-10 w-14 rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Performances */}
      <Skeleton className="h-6 w-48 mb-8 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
