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

        {/* Playoff round label + series dots — many in-season games on Homepage
            are playoff games (May = NBA/NHL conference finals), so reserve the
            slot to avoid CLS when content lands. */}
        <div className="mt-2 pt-2 border-t border-white/[0.04]">
          <div className="flex items-center justify-center">
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center justify-center gap-2.5 mt-1.5">
            <div className="flex items-center gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/10" />
              ))}
            </div>
            <span className="text-[9px] uppercase tracking-[0.15em] text-text-tertiary/40">vs</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/10" />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile-only Breakdown toggle placeholder — matches real GameCard's
            touch-only button (hidden on hover-capable desktop). */}
        <div className="touch-target [@media(hover:hover)]:!hidden mt-3 mx-auto inline-flex items-center gap-1.5">
          <Skeleton className="w-3.5 h-3.5 rounded" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}
