import Skeleton from "../ui/Skeleton.jsx";
import { SkeletonRow } from "./_chrome.jsx";

export default function ReportRowSkeleton() {
  return (
    <SkeletonRow>
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-3 w-10" />
    </SkeletonRow>
  );
}
