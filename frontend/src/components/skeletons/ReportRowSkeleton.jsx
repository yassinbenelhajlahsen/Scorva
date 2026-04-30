import Skeleton from "../ui/Skeleton.jsx";

export default function ReportRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 bg-surface-primary">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}
