import { Fragment } from "react";
import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonCard } from "./_chrome.jsx";
import { TopPerformerCardSkeleton } from "./TopPerformersSkeleton.jsx";
import PredictionCardSkeleton from "./PredictionCardSkeleton.jsx";

function TeamSideSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <Skeleton className="w-20 h-20 sm:w-28 sm:h-28 rounded-full" />
      <div className="flex flex-col items-center sm:items-start gap-2">
        <Skeleton className="h-6 w-20 sm:h-8 sm:w-28 rounded-xl" />
        <Skeleton className="h-8 w-16 sm:h-12 sm:w-20 rounded-xl" />
      </div>
    </div>
  );
}

const INFO_FIELDS = [
  { label: "Date",      width: "w-32" },
  { label: "Status",    width: "w-16" },
  { label: "Location",  width: "w-28" },
  { label: "Broadcast", width: "w-16" },
];

const TAB_LABELS = ["Overview", "Analysis", "Plays"];

export default function GamePageSkeleton({ scheduled = false }) {
  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <Skeleton className="h-4 w-24 mb-8" />

      {/* Matchup header */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 mb-10">
        <TeamSideSkeleton />
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-4 w-6" />
        </div>
        <TeamSideSkeleton />
      </div>

      {/* Game info — standalone card */}
      <div className="mb-6">
        <SkeletonCard>
          <div className="p-5 flex flex-col gap-3">
            {INFO_FIELDS.map(({ label, width }, i) => (
              <Fragment key={label}>
                {i > 0 && <div className="border-t border-white/[0.06]" />}
                <div className="flex items-center justify-between gap-4">
                  <Skeleton className="h-3 w-14 shrink-0" />
                  <Skeleton className={`h-3 ${width}`} />
                </div>
              </Fragment>
            ))}
          </div>
        </SkeletonCard>
      </div>

      {/* Tab bar */}
      <div className="relative flex border-b border-white/[0.06] mb-6">
        {TAB_LABELS.map((label, i) => (
          <div key={label} className="relative px-3 pb-2.5 pt-2">
            <Skeleton className={`h-3.5 ${i === 0 ? "w-16" : i === 1 ? "w-14" : "w-10"}`} />
            {i === 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/[0.08] rounded-full" />
            )}
          </div>
        ))}
      </div>

      {scheduled && (
        <div className="mb-10">
          <PredictionCardSkeleton />
        </div>
      )}

      {/* Overview tab content */}
      {!scheduled && (
        <>
          {/* Quarter scores */}
          <SkeletonCard className="mb-6">
            <div className="p-5">
              <div className="flex items-center gap-x-4 pb-3 border-b border-white/[0.06]">
                <Skeleton className="h-3 flex-1" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-10 shrink-0" />
                ))}
              </div>
              <div className="flex items-center gap-x-4 py-3">
                <Skeleton className="h-3.5 flex-1" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-3.5 w-10 shrink-0" />
                ))}
              </div>
              <div className="border-t border-white/[0.04]" />
              <div className="flex items-center gap-x-4 py-3">
                <Skeleton className="h-3.5 flex-1" />
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-3.5 w-10 shrink-0" />
                ))}
              </div>
            </div>
          </SkeletonCard>

          {/* Top performer cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {Array.from({ length: 3 }).map((_, i) => (
              <TopPerformerCardSkeleton key={i} />
            ))}
          </div>

          {/* Chart placeholder */}
          <SkeletonCard>
            <div className="h-48 animate-pulse" />
          </SkeletonCard>
        </>
      )}
    </div>
  );
}
