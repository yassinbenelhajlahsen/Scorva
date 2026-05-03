import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { m } from "framer-motion";
import { queryFns } from "../lib/query.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUserPrefs } from "../hooks/user/useUserPrefs.js";
import leagueData from "../utils/leagueData.js";
import ReportsList from "../components/reports/ReportsList.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";

const LEAGUE_PILLS = [
  { id: undefined, label: "All" },
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
  { id: "nhl", label: "NHL" },
];
const LEAGUE_IDS = new Set(LEAGUE_PILLS.map((p) => p.id).filter(Boolean));

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

  const { session } = useAuth();
  const { prefs, loading: prefsLoading } = useUserPrefs();
  const hasAppliedDefaultRef = useRef(false);

  useEffect(() => {
    if (hasAppliedDefaultRef.current) return;
    if (session === undefined) return;
    if (session && (prefsLoading || prefs === null)) return;
    hasAppliedDefaultRef.current = true;

    if (searchParams.get("league")) return;
    const def = session ? prefs?.default_league : null;
    if (!def || !LEAGUE_IDS.has(def)) return;

    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set("league", def);
        return sp;
      },
      { replace: true },
    );
  }, [session, prefs, prefsLoading, searchParams, setSearchParams]);

  const tabNavRef = useRef(null);
  const tabRefs = useRef([]);
  const [indicatorBounds, setIndicatorBounds] = useState(null);

  useLayoutEffect(() => {
    const idx = LEAGUE_PILLS.findIndex((p) => p.id === league);
    const btn = tabRefs.current[idx];
    const nav = tabNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setIndicatorBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [league]);

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
    isFetching,
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
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
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

      {/* League scope (primary) — tab-style with sliding accent indicator */}
      <div ref={tabNavRef} className="relative flex border-b border-white/[0.06] mb-5">
        {indicatorBounds && (
          <m.div
            className="absolute bottom-0 h-0.5 bg-accent pointer-events-none"
            animate={{ left: indicatorBounds.left, width: indicatorBounds.width }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        {LEAGUE_PILLS.map((p, i) => {
          const isActive = p.id === league;
          const logo = p.id ? leagueData[p.id]?.logo : null;
          return (
            <button
              key={p.label}
              ref={(el) => (tabRefs.current[i] = el)}
              type="button"
              onClick={() => setLeague(p.id)}
              className={`relative flex items-center gap-2 px-3 pb-2.5 pt-2 text-sm font-medium transition-colors duration-150 -mb-px cursor-pointer ${
                isActive ? "text-accent" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {logo && <img src={logo} alt="" className="w-4 h-4 object-contain" />}
              <span>{p.label}</span>
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
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors duration-200 ${
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

      <div
        className={`transition-opacity duration-200 ${
          isFetching && !isFetchingNextPage && reports.length > 0
            ? "opacity-60"
            : "opacity-100"
        }`}
      >
        <ReportsList
          reports={reports}
          groupByDate={true}
          loading={isLoading && reports.length === 0}
          skeletonCount={20}
        />
      </div>

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
