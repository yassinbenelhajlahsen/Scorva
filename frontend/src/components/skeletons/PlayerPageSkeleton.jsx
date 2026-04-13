import { Fragment } from "react";
import Skeleton from "../ui/Skeleton.jsx";
import StatCardSkeleton from "./StatCardSkeleton.jsx";

function unslugify(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function SimilarPlayerRowSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton className="w-24 h-3 rounded" />
        <Skeleton className="w-16 h-2.5 rounded" />
      </div>
    </div>
  );
}

export default function PlayerPageSkeleton({ slug, league }) {
  const displayName = slug ? unslugify(slug) : "";

  return (
    <div className="max-w-[1500px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <div className="inline-flex items-center gap-1.5 mb-8 text-sm text-transparent select-none">
        <div className="w-4 h-4" />
        <span>{league?.toUpperCase() || "NBA"}</span>
      </div>

      {/* Player header + info + sidebar */}
      <div className="flex flex-col lg:flex-row gap-8 mb-12">

        {/* Left: headshot + info card */}
        <div className="flex flex-col md:flex-row flex-1 gap-8 min-w-0">

          {/* Headshot + name */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="text-3xl sm:text-4xl font-bold tracking-tight text-transparent select-none">
                  {displayName}
                </span>
                <Skeleton className="absolute inset-0 rounded-xl" />
              </div>
              <svg className="w-7 h-7 fill-none text-text-tertiary/30 shrink-0" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </div>
            <Skeleton className="w-56 h-56 rounded-3xl" />
          </div>

          {/* Info card + averages */}
          <div className="flex-1 flex flex-col gap-6">
            <div className="flex justify-end">
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>

            <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <div className="grid grid-cols-[max-content_auto] gap-x-10 gap-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Fragment key={i}>
                    <span className="relative text-sm text-transparent select-none">
                      Height / Weight
                      <Skeleton className="absolute inset-0 rounded" />
                    </span>
                    <span className="relative text-sm font-medium text-transparent select-none">
                      6&apos; 9&quot; / 250 lbs
                      <Skeleton className="absolute inset-0 rounded" />
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>

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
                      <div className="relative">
                        <span className="text-[10px] uppercase tracking-widest font-medium text-transparent select-none">PTS</span>
                        <Skeleton className="absolute inset-0 rounded" />
                      </div>
                      <Skeleton className="h-9 w-14 rounded-lg mt-1" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Similar Players sidebar */}
        <div className="shrink-0 flex flex-col" style={{ width: "20rem" }}>
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] p-5 h-full flex flex-col">
            <Skeleton className="h-3 w-28 rounded mb-3" />
            <div className="flex flex-col flex-1 justify-between">
              {Array.from({ length: 5 }).map((_, i) => (
                <SimilarPlayerRowSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Performances */}
      <div>
        <Skeleton className="h-7 w-52 rounded-xl mb-6" />

        {/* MonthNavigation skeleton */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-7 h-7 rounded-full bg-white/[0.04]" />
          <Skeleton className="w-48 h-4 rounded" />
          <div className="w-7 h-7 rounded-full bg-white/[0.04]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
