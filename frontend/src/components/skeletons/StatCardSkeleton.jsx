import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonCard } from "./_chrome.jsx";

export default function StatCardSkeleton() {
  return (
    <SkeletonCard className="max-w-sm mx-auto">
      <div className="flex items-stretch">
        <div className="flex-1 min-w-0 p-5 text-center">
          {/* Meta row (opponent / date / result pill) */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Skeleton className="h-3 w-6 rounded-full" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          {/* Stat row */}
          <div className="flex flex-wrap justify-center gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center min-w-[52px] gap-1.5">
                <Skeleton className="h-2.5 w-8" />
                <Skeleton className="h-7 w-12 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        {/* Rating column placeholder — real StatCard renders it when ratingGrade != null */}
        <div className="shrink-0 px-3.5 py-3 flex flex-col items-center justify-center gap-1.5">
          <Skeleton className="h-8 w-10 rounded" />
          <Skeleton className="h-2 w-10" />
        </div>
      </div>
    </SkeletonCard>
  );
}
