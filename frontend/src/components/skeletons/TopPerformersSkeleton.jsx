import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonCard } from "./_chrome.jsx";

function TopPerformerCardSkeleton() {
  return (
    <SkeletonCard railClass="bg-accent/40">
      <div className="flex items-stretch h-[108px]">
        {/* Left slab */}
        <div className="w-[88px] shrink-0 bg-gradient-to-br from-accent/[0.12] to-accent/[0.04] border-r border-accent/[0.15] flex flex-col items-center justify-center gap-1.5">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="h-2 w-14" />
        </div>
        {/* Right zone */}
        <div className="flex-1 flex flex-col justify-between px-3.5 py-3 min-w-0">
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
    </SkeletonCard>
  );
}

export default function TopPerformersSkeleton() {
  return (
    <div data-testid="top-performers-skeleton">
      <Skeleton className="h-[88px] w-full rounded-2xl mb-3" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export { TopPerformerCardSkeleton };
