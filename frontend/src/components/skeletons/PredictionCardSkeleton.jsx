// Inner content placeholders for PredictionCard. The outer chrome
// (top stripe + radial glow + ring) is provided by the consumer —
// for the live PredictionCard, that's the wrapper inside the component.
// For GamePageSkeleton scheduled-game branch, we wrap this in a
// matching outer to mirror the same chrome.
export function PredictionCardInner() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-14 bg-white/[0.06] rounded-full" />
            <div className="h-2.5 w-10 bg-white/[0.04] rounded-full" />
          </div>
        </div>
        <div className="h-8 w-8 bg-white/[0.04] rounded-full" />
        <div className="flex items-center gap-3">
          <div className="space-y-1.5 items-end flex flex-col">
            <div className="h-3.5 w-14 bg-white/[0.06] rounded-full" />
            <div className="h-2.5 w-10 bg-white/[0.04] rounded-full" />
          </div>
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="h-6 w-10 bg-white/[0.08] rounded" />
          <div className="h-6 w-10 bg-white/[0.08] rounded" />
        </div>
        <div className="h-3 bg-white/[0.06] rounded-full" />
      </div>
      <div className="space-y-2 pt-2">
        <div className="h-3 bg-white/[0.05] rounded-full" />
        <div className="h-3 bg-white/[0.05] rounded-full" />
      </div>
    </div>
  );
}

// Standalone version with full chrome — for GamePageSkeleton scheduled-game branch
export default function PredictionCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/[0.06]">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent pointer-events-none" />
      <div className="relative p-5 sm:p-6">
        <PredictionCardInner />
      </div>
    </div>
  );
}
