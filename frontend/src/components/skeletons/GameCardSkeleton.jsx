import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonCard } from "./_chrome.jsx";

export default function GameCardSkeleton() {
  return (
    <SkeletonCard className="max-w-md mx-auto">
      <div className="p-5 text-center">
        <div className="flex items-center justify-between gap-4 h-[120px]">
          {/* Home */}
          <div className="flex flex-col items-center flex-1 gap-1.5">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-8" />
          </div>

          {/* Center */}
          <div className="flex flex-col items-center flex-shrink-0 w-[90px] gap-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2.5 w-10" />
          </div>

          {/* Away */}
          <div className="flex flex-col items-center flex-1 gap-1.5">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-5 w-8" />
          </div>
        </div>
      </div>
    </SkeletonCard>
  );
}
