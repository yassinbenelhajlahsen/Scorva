import Skeleton from "../ui/Skeleton.jsx";
import GameCardSkeleton from "./GameCardSkeleton.jsx";

function unslugify(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function TeamPageSkeleton({ teamId }) {
  const displayName = teamId ? unslugify(teamId) : "";
  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link placeholder */}
      <Skeleton className="h-4 w-20 mb-8" />

      {/* Season selector placeholder */}
      <div className="flex justify-end mb-6">
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>

      {/* Team header */}
      <div className="flex flex-col md:flex-row gap-10 mb-12">
        {/* Logo + name */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="relative">
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-transparent select-none">
              {displayName}
            </span>
            <Skeleton className="absolute inset-0 rounded-xl" />
          </div>
          <Skeleton className="w-44 h-44 rounded-2xl" />
        </div>

        {/* Stats card */}
        <div className="flex-1 flex flex-col">
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-4">
            {/* Location row */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-24" />
            </div>

            <div className="border-t border-white/[0.06]" />

            {/* 3-col stat grid */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 px-3 first:pl-0 last:pr-0">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule heading */}
      <Skeleton className="h-6 w-40 mb-8 rounded-xl" />

      {/* Game grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 justify-items-center items-start">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-full">
            <GameCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
