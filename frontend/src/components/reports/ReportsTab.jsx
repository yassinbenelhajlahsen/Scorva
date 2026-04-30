import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getReports } from "../../api/reports.js";
import ReportsList from "./ReportsList.jsx";
import ErrorState from "../ui/ErrorState.jsx";

const TYPE_PILLS = [
  { id: undefined, label: "All" },
  { id: "injury", label: "Injuries" },
  { id: "move", label: "Moves" },
  { id: "birthday", label: "Birthdays" },
  { id: "streak", label: "Streaks" },
];

const PAGE_SIZE = 20;

export default function ReportsTab({ league }) {
  const [type, setType] = useState(undefined);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["reports", league ?? "all", type ?? "all"],
    queryFn: ({ pageParam = 0, signal }) =>
      getReports({ league, type, limit: PAGE_SIZE, offset: pageParam, signal }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length * PAGE_SIZE : undefined,
    staleTime: 60_000,
    retry: 1,
  });

  const reports = data?.pages.flatMap((p) => p.reports) ?? [];
  const loading = isLoading;

  if (isError && reports.length === 0) {
    return <ErrorState message="Couldn't load reports." onRetry={() => refetch()} />;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {TYPE_PILLS.map((p) => {
          const active = p.id === type;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setType(p.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                active
                  ? "bg-accent text-white border-accent"
                  : "bg-surface-elevated text-text-secondary border-white/[0.08] hover:border-white/[0.14] hover:text-text-primary"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <ReportsList reports={reports} groupByDate={true} loading={loading && reports.length === 0} skeletonCount={6} />

      {!loading && hasNextPage && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            className="bg-surface-elevated hover:bg-surface-overlay border border-white/[0.08] text-text-primary font-medium px-6 py-2.5 rounded-full text-sm transition-all duration-200"
          >
            Load More
          </button>
        </div>
      )}

      {!loading && reports.length === 0 && (
        <p className="text-center text-text-tertiary text-sm py-12">No recent reports.</p>
      )}
    </div>
  );
}
