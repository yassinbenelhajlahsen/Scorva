import Skeleton from "../ui/Skeleton.jsx";

export default function StatCardSkeleton() {
  return (
    <div className="bg-surface-elevated border border-white/[0.08] p-5 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>
      <div className="flex flex-wrap justify-center gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-2.5 w-8" />
            <Skeleton className="h-8 w-12 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
