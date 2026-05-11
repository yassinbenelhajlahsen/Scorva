import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonRow } from "./_chrome.jsx";

export default function SimilarPlayersSkeleton({ count = 4 }) {
  return (
    <div className="w-full max-w-sm">
      <Skeleton className="h-3 w-28 mb-3 ml-3" />
      <div className="flex flex-col">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonRow key={i} className={i < count - 1 ? "border-b border-white/[0.04]" : ""}>
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </SkeletonRow>
        ))}
      </div>
    </div>
  );
}
