import Skeleton from "../ui/Skeleton.jsx";

export default function TopPerformancesCardSkeleton() {
  return (
    <div
      data-testid="top-performances-skeleton"
      className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 max-w-[600px] mx-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl mb-3" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-xl mt-1" />
      ))}
    </div>
  );
}
