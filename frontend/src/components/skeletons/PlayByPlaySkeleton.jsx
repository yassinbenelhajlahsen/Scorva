import Skeleton from "../ui/Skeleton.jsx";

export default function PlayByPlaySkeleton() {
  return (
    <div className="mb-8" data-testid="play-by-play-skeleton">
      {/* Header: icon + title */}
      <div className="flex items-center gap-3 mb-5">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      {/* Filter pill row — ring-style pills */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full" />
        ))}
      </div>

      {/* Plays — hairline-divided rows with team-color rail strips */}
      <div className="flex flex-col">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`relative flex items-start gap-3 py-3 ${i < 7 ? "border-b border-white/[0.04]" : ""}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/[0.06]" />
            <Skeleton className="h-3 w-10 shrink-0 mt-0.5" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
