import Skeleton from "../ui/Skeleton.jsx";

export default function RosterGridSkeleton({ count = 9, statCount = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-20 rounded-full shrink-0" />
            <div className="flex-1 flex flex-col gap-2.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-12 rounded-md mt-1" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-white/[0.05] flex justify-around gap-2">
            {Array.from({ length: statCount }).map((_, j) => (
              <div key={j} className="flex flex-col items-center gap-1.5">
                <Skeleton className="h-2.5 w-7" />
                <Skeleton className="h-4 w-9" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
