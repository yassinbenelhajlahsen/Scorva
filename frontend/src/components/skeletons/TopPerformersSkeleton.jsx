import Skeleton from "../ui/Skeleton.jsx";

export default function TopPerformersSkeleton() {
  return (
    <div data-testid="top-performers-skeleton">
      <Skeleton className="h-[88px] w-full rounded-2xl mb-3" />
      <div className="flex flex-col gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
