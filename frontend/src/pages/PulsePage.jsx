import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { queryFns } from "../lib/query.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUserPrefs } from "../hooks/user/useUserPrefs.js";
import leagueData from "../utils/leagueData.js";
import ReportsList from "../components/reports/ReportsList.jsx";
import HighlightsTab from "../components/highlights/HighlightsTab.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import { SwipeableTabs } from "../components/ui/SwipeableTabs.jsx";

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

const ALL_SUB_TABS = [
  { id: "highlights", label: "Highlights" },
  { id: "reports", label: "Reports" },
];

const PAGE_SIZE = 20;

// Directional slide animation matching SwipeableTabs.
const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
};

function SlideSwap({ swapKey, direction = 1, children }) {
  return (
    <div className="relative overflow-hidden">
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <m.div
          key={swapKey}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 350, damping: 32 },
            opacity: { duration: 0.18 },
          }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

export default function PulsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const league = searchParams.get("league") || undefined;
  const type = searchParams.get("type") || undefined;
  const subTabParam = searchParams.get("tab");

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

  // Direction tracking for slide animations — read synchronously during render
  // so AnimatePresence can pick the right variant before the swap.
  const leagueIdx = Math.max(0, LEAGUE_PILLS.findIndex((p) => p.id === league));
  const prevLeagueIdxRef = useRef(leagueIdx);
  const leagueDirRef = useRef(0);
  const leagueJustChanged = prevLeagueIdxRef.current !== leagueIdx;
  if (leagueJustChanged) {
    leagueDirRef.current = leagueIdx > prevLeagueIdxRef.current ? 1 : -1;
    prevLeagueIdxRef.current = leagueIdx;
  }

  // League pill (top-level scope) sliding indicator
  const leagueNavRef = useRef(null);
  const leagueRefs = useRef([]);
  const [leagueBounds, setLeagueBounds] = useState(null);

  useLayoutEffect(() => {
    const idx = LEAGUE_PILLS.findIndex((p) => p.id === league);
    const btn = leagueRefs.current[idx];
    const nav = leagueNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setLeagueBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [league]);

  const showHighlights = league === "nba";
  // Keep the underlying tabs array stable so SwipeableTabs's direction tracking
  // (based on index transitions) gives the correct direction when the league
  // pill change forces a sub-tab swap. The pill strip renders `visibleSubTabs`
  // separately to hide the highlights button on NFL/NHL.
  const subTabs = ALL_SUB_TABS;
  const visibleSubTabs = useMemo(
    () => (showHighlights ? ALL_SUB_TABS : ALL_SUB_TABS.filter((t) => t.id === "reports")),
    [showHighlights],
  );

  const resolvedSubTab = ALL_SUB_TABS.find((t) => t.id === subTabParam)?.id
    ?? (showHighlights ? "highlights" : "reports");
  // Highlights tab is gated behind league=nba/all — coerce to reports otherwise
  // (the useEffect below also clears the URL param to keep state consistent).
  const subTab = !showHighlights && resolvedSubTab === "highlights"
    ? "reports"
    : resolvedSubTab;

  // If user is on highlights and switches to NFL/NHL, drop the tab param so
  // they land on reports
  useEffect(() => {
    if (!showHighlights && subTabParam === "highlights") {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          sp.delete("tab");
          return sp;
        },
        { replace: true },
      );
    }
  }, [showHighlights, subTabParam, setSearchParams]);

  // Sub-tab pill indicator
  const subTabNavRef = useRef(null);
  const subTabRefs = useRef([]);
  const [subTabBounds, setSubTabBounds] = useState(null);

  useLayoutEffect(() => {
    const idx = visibleSubTabs.findIndex((t) => t.id === subTab);
    const btn = subTabRefs.current[idx];
    const nav = subTabNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setSubTabBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [subTab, visibleSubTabs]);

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

  function setSubTab(next) {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        const fallback = showHighlights ? "highlights" : "reports";
        if (!next || next === fallback) sp.delete("tab");
        else sp.set("tab", next);
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
    enabled: subTab === "reports",
  });

  const reports = data?.pages?.flatMap((p) => p.reports ?? []) ?? [];

  if (subTab === "reports" && isError && reports.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12">
        <ErrorState
          message="Couldn't load reports."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const highlightsContent = (
    <SlideSwap swapKey={`league:${league ?? "all"}`} direction={leagueDirRef.current}>
      <HighlightsTab />
    </SlideSwap>
  );

  const reportsContent = (
    <div>
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

      <SlideSwap swapKey={`league:${league ?? "all"}`} direction={leagueDirRef.current}>
        <div>
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
      </SlideSwap>
    </div>
  );

  const tabContents = {
    highlights: highlightsContent,
    reports: reportsContent,
  };

  const swipeableTabs = subTabs.map((t) => ({ id: t.id, content: tabContents[t.id] }));

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12">
      <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">
        Pulse
      </h1>
      <p className="text-sm text-text-secondary mb-8">
        Top performances and recent injuries, moves, birthdays, and streaks across the leagues.
      </p>

      {/* League scope (primary) */}
      <div ref={leagueNavRef} className="relative flex border-b border-white/[0.06] mb-6">
        {leagueBounds && (
          <m.div
            className="absolute bottom-0 h-0.5 bg-accent pointer-events-none"
            animate={{ left: leagueBounds.left, width: leagueBounds.width }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        {LEAGUE_PILLS.map((p, i) => {
          const isActive = p.id === league;
          const logo = p.id ? leagueData[p.id]?.logo : null;
          return (
            <button
              key={p.label}
              ref={(el) => (leagueRefs.current[i] = el)}
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

      {/* Sub-tabs (sliding underline) */}
      {visibleSubTabs.length > 1 && (
        <div ref={subTabNavRef} className="relative flex border-b border-white/[0.06] mb-8">
          {subTabBounds && (
            <m.div
              className="absolute bottom-0 h-0.5 bg-accent pointer-events-none"
              animate={{ left: subTabBounds.left, width: subTabBounds.width }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          {visibleSubTabs.map((t, i) => {
            const isActive = subTab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => (subTabRefs.current[i] = el)}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`relative flex items-center gap-2 px-3 pb-2.5 pt-2 text-sm font-medium transition-colors duration-150 -mb-px cursor-pointer ${
                  isActive ? "text-accent" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <SwipeableTabs
        activeId={subTab}
        onChange={setSubTab}
        tabs={swipeableTabs}
        className="py-1"
        directionOverride={leagueJustChanged ? leagueDirRef.current : null}
      />
    </div>
  );
}
