import Skeleton from "../ui/Skeleton.jsx";

function unslugify(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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

export default function PlayerPageSkeleton({ slug, league }) {
  const displayName = slug ? unslugify(slug) : "";

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link — matches real <Link> structure: inline-flex items-center gap-1.5 with SVG */}
      <div className="inline-flex items-center gap-1.5 mb-8 text-sm text-transparent select-none">
        <div className="w-4 h-4" />
        <span>{league?.toUpperCase() || "NBA"}</span>
      </div>

      {/* Player header */}
      <div className="flex flex-col md:flex-row gap-8 mb-12">
        {/* Headshot + name */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-transparent select-none">
                {displayName}
              </span>
              <Skeleton className="absolute inset-0 rounded-xl" />
            </div>
          </div>
          <Skeleton className="w-56 h-56 rounded-3xl ring-1 ring-white/[0.08]" />
        </div>

        {/* Info card + averages */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex justify-end">
            <div className="relative inline-flex items-center">
              <Skeleton className="rounded-xl px-4 py-2 pr-8 text-sm font-medium w-36" />
            </div>
          </div>

          {/* Info card — use real text-sm spans for exact row height */}
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="grid grid-cols-[max-content_auto] gap-x-10 gap-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <>
                  <div key={`l${i}`} className="relative">
                    <span className="text-sm text-transparent select-none">Height / Weight</span>
                    <Skeleton className="absolute inset-0 rounded" />
                  </div>
                  <div key={`v${i}`} className="relative">
                    <span className="text-sm font-medium text-transparent select-none">6&apos; 9&quot; / 250 lbs</span>
                    <Skeleton className="absolute inset-0 rounded" />
                  </div>
                </>
              ))}
            </div>
          </div>

          {/* Season averages card — match real header with py-2.5 + text-xs */}
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
            <div className="relative">
              <div className="text-center text-xs font-semibold uppercase tracking-widest py-2.5 px-6 text-transparent select-none">
                &nbsp;
              </div>
              <Skeleton className="absolute inset-0 rounded-none" />
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-y-6 gap-x-10 justify-center">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center min-w-[72px]">
                    <Skeleton className="h-2.5 w-10" />
                    <Skeleton className="h-10 w-14 rounded-lg mt-1" />
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
