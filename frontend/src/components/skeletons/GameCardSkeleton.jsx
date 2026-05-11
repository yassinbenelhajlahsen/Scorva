import Skeleton from "../ui/Skeleton.jsx";

export default function GameCardSkeleton() {
  return (
    <div className="relative max-w-md mx-auto">
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/15" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/[0.04] to-transparent pointer-events-none" />
      <div className="relative p-5 text-center">
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

        {/* Mobile-only Breakdown toggle placeholder — matches real GameCard's
            touch-only button (hidden on hover-capable desktop) so card height
            doesn't shrink on mobile during loading. */}
        <div className="touch-target [@media(hover:hover)]:!hidden mt-3 mx-auto inline-flex items-center gap-1.5">
          <Skeleton className="w-3.5 h-3.5 rounded" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}
