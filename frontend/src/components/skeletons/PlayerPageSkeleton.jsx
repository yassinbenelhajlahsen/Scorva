import Skeleton from "../ui/Skeleton.jsx";
import StatCardSkeleton from "./StatCardSkeleton.jsx";
import { SkeletonCard, SkeletonRow } from "./_chrome.jsx";

function unslugify(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

      {/* Hero: headshot + name + (details | rankings) */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-8">
        <Skeleton className="w-40 h-40 md:w-48 md:h-48 rounded-3xl shrink-0" />

        <div className="flex flex-col w-full md:flex-1 min-w-0 gap-3">
          {/* Name row */}
          <div className="flex justify-center md:justify-start">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="text-3xl sm:text-4xl font-bold tracking-tight text-transparent select-none">
                  {displayName || "Player Name"}
                </span>
                <Skeleton className="absolute inset-0 rounded-xl" />
              </div>
              <svg className="w-7 h-7 fill-none text-text-tertiary/30 shrink-0" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </div>
          </div>

          {/* Two-col row: details (left) + rankings (right) — stays side-by-side on mobile */}
          <div className="flex flex-row items-start gap-4 md:gap-6">
            {/* Details column */}
            <div className="flex flex-col gap-3 items-center md:items-start min-w-0 flex-1">
              {/* Team link */}
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-7 h-7 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
              {/* Jersey · Position · Height/Weight */}
              <Skeleton className="h-4 w-44 rounded" />
              {/* DOB · Draft */}
              <Skeleton className="h-3.5 w-56 rounded" />
              {/* Status + Streak badges row */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              {/* NextGameCard slot (h-[88px]) */}
              <SkeletonCard className="w-full max-w-[260px] mt-1">
                <div className="h-[88px] flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </SkeletonCard>
            </div>

            {/* Rankings column — matches PlayerRankings live width (w-[140px] sm:w-[170px]) */}
            <div className="shrink-0 w-[140px] sm:w-[170px]">
              <SkeletonCard railClass="bg-transparent">
                <div className="p-3 space-y-2.5">
                  <Skeleton className="h-2.5 w-16 mx-auto" />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <Skeleton className="h-3 w-10" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  ))}
                </div>
              </SkeletonCard>
            </div>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div className="relative flex border-b border-white/[0.06] mb-8">
        <div className="px-3 pb-2.5 pt-2">
          <Skeleton className="h-4 w-14 rounded" />
        </div>
        <div className="px-3 pb-2.5 pt-2">
          <Skeleton className="h-4 w-20 rounded" />
        </div>
      </div>

      {/* Profile tab skeleton (default tab) */}

      {/* Compare + season selector row */}
      <div className="flex justify-end gap-2 mb-4">
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* Averages + similar players sidebar */}
      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        <div className="flex-1 min-w-0">
          {/* PlayerAvgCard — top accent stripe + gradient (no rail chrome) */}
          <div className="relative overflow-hidden rounded-2xl w-full">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
            <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.06] via-transparent to-transparent pointer-events-none" />
            <div className="relative">
              <div className="text-accent text-[11px] uppercase tracking-[0.22em] font-semibold text-center pt-4 pb-3 border-b border-white/[0.05]">
                <span className="text-transparent select-none">Regular Season</span>
              </div>
              <div className="px-6 py-7">
                <ul className="flex flex-wrap gap-y-6 justify-around w-full">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="flex flex-col items-center flex-1 min-w-[72px] gap-1.5">
                      <Skeleton className="h-2.5 w-10" />
                      <Skeleton className="h-10 w-14 rounded-lg" />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SimilarPlayersCard sidebar — matches live w-[400px] on lg */}
        <div className="w-full lg:w-[400px] lg:shrink-0">
          <Skeleton className="h-3 w-28 mb-3 ml-3" />
          <div className="flex flex-col">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} className={i < 3 ? "border-b border-white/[0.04]" : ""}>
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </SkeletonRow>
            ))}
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
