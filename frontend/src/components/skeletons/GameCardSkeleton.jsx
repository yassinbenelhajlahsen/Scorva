import Skeleton from "../ui/Skeleton.jsx";

export default function GameCardSkeleton() {
  return (
    <div className="bg-surface-elevated border border-white/[0.08] p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-4 h-[120px]">
        {/* Home team */}
        <div className="flex flex-col items-center flex-1 gap-2">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-5 w-8" />
        </div>

        {/* Center */}
        <div className="flex flex-col items-center flex-shrink-0 w-[90px] gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-5" />
          <Skeleton className="h-3 w-14 mt-1" />
        </div>

        {/* Away team */}
        <div className="flex flex-col items-center flex-1 gap-2">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-5 w-8" />
        </div>
      </div>
    </div>
  );
}
