import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { m, AnimatePresence } from "framer-motion";

import GameCard from "../components/cards/GameCard";
import SeasonSelector from "../components/navigation/SeasonSelector.jsx";
import MonthNavigation from "../components/navigation/MonthNavigation.jsx";
import RosterGrid from "../components/team/RosterGrid.jsx";
import RosterGridSkeleton from "../components/skeletons/RosterGridSkeleton.jsx";
import { useTeam } from "../hooks/data/useTeam.js";
import { useTeamRoster } from "../hooks/data/useTeamRoster.js";
import { useSeasonParam } from "../hooks/useSeasonParam.js";
import { useSeasons } from "../hooks/data/useSeasons.js";
import buildSeasonUrl from "../utils/buildSeasonUrl.js";
import { containerVariants, itemVariants } from "../utils/motion.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavoriteToggle } from "../hooks/user/useFavoriteToggle.js";
import slugify from "../utils/slugify.js";
import TeamPageSkeleton from "../components/skeletons/TeamPageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { PullToRefresh } from "../components/ui/PullToRefresh.jsx";

const TABS = ["schedule", "players"];

export default function TeamPage() {
  const { league: rawLeague, teamId } = useParams();
  const league = (rawLeague || "").toLowerCase();
  const [searchParams] = useSearchParams();
  const urlSeason = searchParams.get("season") || null;
  const { team, games, availableSeasons, teamRecord, homeRecord, awayRecord, loading, recordsLoading, seasonLoading, error, retry, refetch } = useTeam(league, teamId, urlSeason);

  const handleRefresh = async () => {
    await refetch();
  };
  const { seasons: leagueSeasons } = useSeasons(league);
  const [selectedSeason, setSelectedSeason] = useSeasonParam(availableSeasons.length > 0 ? availableSeasons : [], leagueSeasons[0] ?? null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const [activeTab, setActiveTab] = useState("schedule");
  const [tabDirection, setTabDirection] = useState(1);
  const tabRefs = useRef([]);
  const tabNavRef = useRef(null);
  const [pillBounds, setPillBounds] = useState(null);

  const {
    roster,
    loading: rosterLoading,
    error: rosterError,
    retry: rosterRetry,
  } = useTeamRoster(league, team?.id ?? null, selectedSeason, {
    enabled: activeTab === "players",
  });

  useLayoutEffect(() => {
    const idx = TABS.indexOf(activeTab);
    const btn = tabRefs.current[idx];
    const nav = tabNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setPillBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [activeTab, team]);

  function pickTab(tab) {
    setTabDirection(TABS.indexOf(tab) > TABS.indexOf(activeTab) ? 1 : -1);
    setActiveTab(tab);
  }

  useEffect(() => {
    setSelectedMonth(null);
  }, [selectedSeason]);

  useEffect(() => {
    if (!games?.length) return;
    const months = [...new Set(games.map((g) => String(g.date).slice(0, 7)))].sort();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (months.includes(currentMonth)) {
      setSelectedMonth(currentMonth);
      return;
    }
    const pastMonths = months.filter((m) => m < currentMonth);
    if (pastMonths.length) {
      setSelectedMonth(pastMonths[pastMonths.length - 1]);
      return;
    }
    setSelectedMonth(months[0]);
  }, [games]);

  const { session, openAuthModal } = useAuth();
  const { isFavorited, toggle } = useFavoriteToggle("team", session ? team?.id : null);

  const filteredGames = useMemo(() => {
    if (!selectedMonth) return games;
    return games.filter((g) => String(g.date).slice(0, 7) === selectedMonth);
  }, [games, selectedMonth]);

  if (loading) return <TeamPageSkeleton teamId={teamId} />;
  if (error && !team) return <ErrorState message={error} onRetry={retry} />;
  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">Team Not Found</h1>
        <p className="text-text-secondary text-sm mb-8 text-center max-w-md">
          The team you&apos;re looking for doesn&apos;t exist or hasn&apos;t been added yet.
        </p>
        <Link
          to={buildSeasonUrl(`/${league}`, selectedSeason)}
          className="bg-accent text-white font-semibold py-3 px-6 rounded-full text-sm transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(232,134,58,0.3)]"
        >
          {league?.toUpperCase()} Teams
        </Link>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <Link
        to={`/${league}${selectedSeason ? `?season=${selectedSeason}` : ""}`}
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{league?.toUpperCase()}</span>
      </Link>

      {/* Season selector + Compare */}
      <div className="flex justify-end gap-2 mb-6">
        <Link
          to="/compare"
          state={{ league, type: "teams", id1: slugify(team.name) }}
          className="inline-flex items-center gap-1.5 appearance-none bg-surface-elevated border border-white/[0.08] rounded-xl text-text-primary text-sm font-medium px-4 py-2 cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:bg-surface-overlay"
          aria-label="Compare team"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Compare
        </Link>
        <SeasonSelector
          league={league}
          selectedSeason={selectedSeason}
          onSeasonChange={setSelectedSeason}
          seasons={availableSeasons.length > 0 ? availableSeasons : undefined}
        />
      </div>

      {/* Team header + info */}
      <div className="flex flex-col md:flex-row gap-10 mb-12">
        {/* Logo + name */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary text-center md:text-left">
              {team.name}
            </h1>
            <button
              onClick={() => session ? toggle() : openAuthModal("favorites")}
              aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
              className="transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <svg className={`w-7 h-7 ${isFavorited ? "fill-yellow-400 text-yellow-400" : "fill-none text-text-tertiary hover:text-yellow-400"}`} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </button>
          </div>
          {team.logo_url && (
            <img
              src={team.logo_url}
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.style.display = "none"; }}
              alt={team.name}
              className="w-44 h-44 object-contain"
            />
          )}
        </div>

        {/* Stats card */}
        <div className="flex-1 flex flex-col">
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-text-tertiary">Location</span>
              <span className="text-sm font-medium text-text-primary">{team.location}</span>
            </div>

            <div className="border-t border-white/[0.06]" />

            <div
              className="grid grid-cols-3 divide-x divide-white/[0.06]"
              style={{ opacity: seasonLoading ? 0.5 : 1, transition: 'opacity 200ms ease' }}
            >
              {[
                { label: "Record", value: teamRecord ?? team.record, skeleton: false },
                { label: "Home", value: homeRecord, skeleton: recordsLoading },
                { label: "Away", value: awayRecord, skeleton: recordsLoading },
              ].map(({ label, value, skeleton }) => (
                <div key={label} className="flex flex-col items-center gap-1 px-3 first:pl-0 last:pr-0">
                  <span className="text-xs uppercase tracking-wider text-text-tertiary">{label}</span>
                  {skeleton
                    ? <Skeleton className="h-7 w-16 mt-0.5" />
                    : <span className="text-xl font-bold tabular-nums text-text-primary">{value ?? "—"}</span>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab pills */}
      <div className="flex justify-center mb-8">
        <div ref={tabNavRef} className="relative flex gap-0 bg-surface-elevated border border-white/[0.08] rounded-full p-1">
          {pillBounds && (
            <m.div
              className="absolute inset-y-1 rounded-full bg-accent/15 border border-accent/25 pointer-events-none"
              initial={{ left: pillBounds.left, width: pillBounds.width }}
              animate={{ left: pillBounds.left, width: pillBounds.width }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          {TABS.map((tab, i) => (
            <button
              key={tab}
              ref={(el) => (tabRefs.current[i] = el)}
              onClick={() => pickTab(tab)}
              className="relative px-5 py-2 rounded-full text-sm font-medium z-10 transition-colors duration-200"
              style={{ color: activeTab === tab ? "var(--color-accent)" : "var(--color-text-secondary)" }}
            >
              <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="overflow-x-clip">
        <AnimatePresence mode="wait" custom={tabDirection} initial={false}>
          <m.div
            key={activeTab}
            custom={tabDirection}
            variants={{
              initial: (dir) => ({ x: dir * 40, opacity: 0 }),
              animate: { x: 0, opacity: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
              exit: (dir) => ({ x: dir * -40, opacity: 0, transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } }),
            }}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {activeTab === "schedule" ? (
              <>
                <MonthNavigation
                  games={games}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                />
                <div style={{ opacity: seasonLoading ? 0.5 : 1, transition: 'opacity 200ms ease' }}>
                  {filteredGames.length > 0 ? (
                    <m.div
                      key={selectedSeason}
                      className="grid grid-cols-1 md:grid-cols-2 gap-5 justify-items-center items-start"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {filteredGames.map((game) => (
                        <m.div key={game.id} variants={itemVariants} className="w-full">
                          <GameCard game={game} />
                        </m.div>
                      ))}
                    </m.div>
                  ) : (
                    <p className="text-center text-text-tertiary text-sm mt-8">
                      {games.length > 0 ? "No games this month." : "No recent games to show."}
                    </p>
                  )}
                </div>
              </>
            ) : rosterError ? (
              <ErrorState message={rosterError} onRetry={rosterRetry} />
            ) : rosterLoading ? (
              <RosterGridSkeleton statCount={league === "nba" ? 4 : 3} />
            ) : (
              <RosterGrid
                league={league}
                season={selectedSeason}
                players={roster}
                showStatus={!selectedSeason || selectedSeason === leagueSeasons[0]}
              />
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
    </PullToRefresh>
  );
}
