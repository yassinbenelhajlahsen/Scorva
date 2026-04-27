import Skeleton from "../ui/Skeleton.jsx";

export default function RosterGridSkeleton({ count = 9 }) {
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
        </div>
      ))}
    </div>
  );
}
