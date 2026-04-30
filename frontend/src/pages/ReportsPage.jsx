import { useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { queryFns } from "../lib/query.js";
import ReportsList from "../components/reports/ReportsList.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";

const LEAGUE_PILLS = [
  { id: undefined, label: "All" },
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
  { id: "nhl", label: "NHL" },
];

const TYPE_PILLS = [
  { id: undefined, label: "All" },
  { id: "injury", label: "Injuries" },
  { id: "move", label: "Moves" },
  { id: "birthday", label: "Birthdays" },
  { id: "streak", label: "Streaks" },
];

const PAGE_SIZE = 20;

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const league = searchParams.get("league") || undefined;
  const type = searchParams.get("type") || undefined;

  function setLeague(next) {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (!next) sp.delete("league");
        else sp.set("league", next);
        return sp;
      },
      { replace: true },
    );
  }

  function setType(next) {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (!next) sp.delete("type");
        else sp.set("type", next);
        return sp;
      },
      { replace: true },
    );
  }

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["reports", league ?? "all", type ?? "all"],
    queryFn: ({ pageParam = 0, signal }) =>
      queryFns.reports(league, type, PAGE_SIZE, pageParam)({ signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage?.hasMore ? allPages.length * PAGE_SIZE : undefined,
    staleTime: 60_000,
    retry: 1,
  });

  const reports = data?.pages?.flatMap((p) => p.reports ?? []) ?? [];

  if (isError && reports.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12">
        <ErrorState
          message="Couldn't load reports."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12">
      <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">
        Reports
      </h1>
      <p className="text-sm text-text-secondary mb-8">
        Recent injuries, moves, birthdays, and streaks across the leagues.
      </p>

      {/* League filter */}
      <div className="flex flex-wrap gap-2 mb-3">
        {LEAGUE_PILLS.map((p) => {
          const active = p.id === league;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setLeague(p.id)}
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

      {/* Type filter */}
      <div className="flex flex-wrap gap-2 mb-6">
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

      <ReportsList
        reports={reports}
        groupByDate={true}
        loading={isLoading && reports.length === 0}
        skeletonCount={6}
      />

      {!isLoading && hasNextPage && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="bg-surface-elevated hover:bg-surface-overlay border border-white/[0.08] text-text-primary font-medium px-6 py-2.5 rounded-full text-sm transition-all duration-200 disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {!isLoading && reports.length === 0 && (
        <p className="text-center text-text-tertiary text-sm py-12">
          No recent reports.
        </p>
      )}
    </div>
  );
}
