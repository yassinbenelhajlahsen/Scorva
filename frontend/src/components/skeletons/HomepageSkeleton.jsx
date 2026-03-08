import Skeleton from "../ui/Skeleton.jsx";
import GameCardSkeleton from "./GameCardSkeleton.jsx";

export default function HomepageSkeleton({ session }) {
  return (
    <div className="flex flex-col w-full max-w-[1200px] mx-auto px-5 sm:px-8 py-12">
      {/* Hero */}
      <div className="text-center mb-14 mt-2 flex flex-col items-center gap-4">
        <Skeleton className="h-14 w-48 sm:w-64 rounded-2xl" />
        <Skeleton className="h-4 w-72 sm:w-96" />
      </div>

      {/* Favorites skeleton — only when logged in */}
      {session && (
        <div className="mb-14 flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 flex flex-col sm:flex-row gap-5 items-stretch"
            >
              {/* Player/team info */}
              <div className="flex items-center gap-4 shrink-0 w-full sm:w-52">
                <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />
                <div className="flex flex-col gap-2 flex-1">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="hidden sm:block w-px bg-white/[0.06] self-stretch shrink-0" />
              {/* Stat cards */}
              <div className="flex gap-3 flex-1 min-w-0">
                {[0, 1].map((j) => (
                  <Skeleton key={j} className="flex-1 min-w-[8rem] h-24 rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* League tab pills */}
      <div className="flex justify-center mb-8 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>

      {/* Game grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
        {Array.from({ length: 6 }).map((_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
