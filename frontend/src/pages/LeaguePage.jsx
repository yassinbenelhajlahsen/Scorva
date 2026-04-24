import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useMemo, useRef, useLayoutEffect, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../lib/query.js";
import { m, AnimatePresence } from "framer-motion";

import GameCard from "../components/cards/GameCard.jsx";
import leagueData from "../utils/leagueData";
import slugify from "../utils/slugify.js";
import SeasonSelector from "../components/navigation/SeasonSelector.jsx";
import DateNavigation from "../components/ui/DateNavigation.jsx";
import { useLeagueData } from "../hooks/data/useLeagueData.js";
import { useGameDates } from "../hooks/data/useGameDates.js";
import { useSeasons } from "../hooks/data/useSeasons.js";
import { useSeasonParam } from "../hooks/useSeasonParam.js";
import buildSeasonUrl from "../utils/buildSeasonUrl.js";
import { containerVariants, itemVariants } from "../utils/motion.js";
import LeaguePageSkeleton from "../components/skeletons/LeaguePageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import PlayoffsBracket from "../components/playoffs/PlayoffsBracket.jsx";
import LeagueSlate from "../components/navigation/LeagueSlate.jsx";
import { LEAGUE_LABELS } from "../constants/leagueLabels.js";

// Returns the cutoff indices for each playoff tier per conference.
// `playoffs` = count of teams in the guaranteed-playoff tier (indices 0..playoffs-1).
// `playIn` = exclusive upper bound for the play-in tier (indices playoffs..playIn-1).
// Anything at index >= playIn is "out". Null season = current (latest rules).
function getPlayoffTiers(league, season) {
  const startYear = season ? parseInt(season.slice(0, 4), 10) : Infinity;
  if (league === "nba") {
    // Play-in tournament became permanent starting 2020-21 season.
    return startYear >= 2020
      ? { playoffs: 6, playIn: 10 }
      : { playoffs: 8, playIn: 8 };
  }
  if (league === "nfl") {
    // Expanded from 12 to 14 teams (6 → 7 per conference) starting 2020 season.
    return startYear >= 2020
      ? { playoffs: 7, playIn: 7 }
      : { playoffs: 6, playIn: 6 };
  }
  if (league === "nhl") {
    return { playoffs: 8, playIn: 8 };
  }
  return { playoffs: 0, playIn: 0 };
}

export default function LeaguePage() {
  const queryClient = useQueryClient();
  const { league } = useParams();
  const data = leagueData[league?.toLowerCase()];
  const { seasons } = useSeasons(league);
  const [selectedSeason, setSelectedSeason] = useSeasonParam(seasons);
  const [selectedDate, setSelectedDate] = useState(null);
  const [animateCards, setAnimateCards] = useState(false);
  const [activeTab, setActiveTab] = useState("games");
  const [tabDirection, setTabDirection] = useState(1);
  const tabRefs = useRef([]);
  const tabNavRef = useRef(null);
  const [pillBounds, setPillBounds] = useState(null);

  const { games, standings, standingsFetching, error, displayData, retry, resolvedDate, resolvedSeason } =
    useLeagueData(league, selectedSeason, selectedDate);
  const { dates: gameDates, gameCounts, loading: datesLoading } = useGameDates(league, selectedSeason);

  const tabs = useMemo(
    () => LEAGUE_LABELS[league]?.playoffsSupported
      ? ["games", "standings", "playoffs"]
      : ["games", "standings"],
    [league]
  );

  useLayoutEffect(() => {
    const idx = tabs.indexOf(activeTab);
    const btn = tabRefs.current[idx];
    const nav = tabNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setPillBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [activeTab, tabs]);

  function pickTab(tab) {
    setTabDirection(tabs.indexOf(tab) > tabs.indexOf(activeTab) ? 1 : -1);
    setActiveTab(tab);
  }

  // Sync date strip when backend resolved a nearest-date redirect.
  // Only depend on resolvedDate — not selectedDate — to avoid overriding
  // a new selection with a stale resolvedDate from a previous fetch.
  useEffect(() => {
    if (resolvedDate) setSelectedDate(resolvedDate);
  }, [resolvedDate]);

  useEffect(() => {
    // Only sync resolvedSeason when an explicit season is already selected —
    // never convert selectedSeason=null (current season) to an explicit string,
    // as that would trigger a full reload on the first date pick.
    if (resolvedSeason && selectedSeason !== null && resolvedSeason !== selectedSeason) {
      setSelectedSeason(resolvedSeason);
    }
  }, [resolvedSeason]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDateChange(date) {
    setAnimateCards(true);
    setSelectedDate(date);
  }

  // Reset date selection when user switches seasons
  function handleSeasonChange(season) {
    setAnimateCards(false);
    setSelectedSeason(season);
    setSelectedDate(null);
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">
          League Not Found
        </h1>
        <p className="text-text-secondary text-sm mb-8 text-center max-w-md">
          The league you&apos;re looking for doesn&apos;t exist or isn&apos;t
          supported yet.
        </p>
        <Link
          to="/"
          className="bg-accent text-white font-semibold py-3 px-6 rounded-full text-sm transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(232,134,58,0.3)]"
        >
          Back to Homepage
        </Link>
      </div>
    );
  }

  // Today's-games strip — only on games tab + current season
  const showSlate = activeTab === "games" && !selectedSeason;

  function renderStandingsRows(teams) {
    const tiers = getPlayoffTiers(league, selectedSeason);
    const tierFor = (i) =>
      i < tiers.playoffs ? "playoffs" : i < tiers.playIn ? "playIn" : "out";
    const TIER_LABEL = { playoffs: "Playoffs", playIn: "Play-In", out: "Out" };
    // Tier styling — each set keyed by classes for spine, header tint, header border, and text color.
    const TIER_STYLE = {
      playoffs: {
        spine: "bg-win",
        tint: "bg-transparent",
        border: "border-win/30",
        text: "text-win",
      },
      playIn: {
        spine: "bg-accent",
        tint: "bg-transparent",
        border: "border-accent/30",
        text: "text-accent",
      },
      out: {
        spine: "bg-transparent",
        tint: "bg-transparent",
        border: "border-white/[0.08]",
        text: "text-text-tertiary",
      },
    };
    return teams.map((team, index) => {
      const tier = tierFor(index);
      const style = TIER_STYLE[tier];
      const showHeader = index === 0 || tierFor(index - 1) !== tier;
      const isLast = index === teams.length - 1;
      const nextStartsNewTier = !isLast && tierFor(index + 1) !== tier;
      const showRowBorder = !isLast && !nextStartsNewTier;
      return (
        <Fragment key={team.id}>
          {showHeader && (
            <div
              className={`flex items-center justify-between px-5 py-2.5 ${style.tint} ${
                index === 0 ? "" : `border-t ${style.border}`
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-[3px] h-3.5 rounded-sm ${style.spine}`} />
                <span
                  className={`text-[11px] font-bold uppercase tracking-[0.12em] ${style.text}`}
                >
                  {TIER_LABEL[tier]}
                </span>
              </div>
            </div>
          )}
          <Link
            to={buildSeasonUrl(`/${league}/teams/${slugify(team.name)}`, selectedSeason)}
            onMouseEnter={() => queryClient.prefetchQuery({ queryKey: queryKeys.team(league, slugify(team.name)), queryFn: queryFns.team(league, slugify(team.name)), staleTime: 10_000 })}
          >
            <div
              className={`relative flex justify-between items-center pl-6 pr-5 py-3 hover:bg-surface-overlay transition-colors duration-150 cursor-pointer ${
                showRowBorder ? "border-b border-white/[0.04]" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute left-0 top-0 bottom-0 w-[3px] ${style.spine}`}
              />
              <div className="flex items-center gap-3">
                <span className="w-5 text-right text-text-tertiary text-xs tabular-nums">
                  {index + 1}
                </span>
                <img
                  loading="lazy"
                  src={team.logo_url}
                  alt={`${team.name} logo`}
                  className="w-6 h-6 object-contain"
                />
                <span className="text-sm font-medium text-text-primary">
                  {team.name}
                </span>
              </div>
              <span className="text-sm text-text-secondary tabular-nums">
                {league === "nhl"
                  ? `${team.wins}–${team.losses - (team.otl || 0)}–${team.otl || 0}`
                  : league === "nfl" && (team.ties || 0) > 0
                  ? `${team.wins}–${team.losses}–${team.ties}`
                  : `${team.wins}–${team.losses}`}
              </span>
            </div>
          </Link>
        </Fragment>
      );
    });
  }

  // Playoffs bracket needs a wider container than the header/date strip
  const contentMaxWidth =
    activeTab === "playoffs" ? "max-w-[1600px]" : "max-w-[1200px]";

  return (
    <div className="px-5 sm:px-8 py-8">
      <div className="max-w-[1200px] mx-auto">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span>Home</span>
      </Link>

      {/* League header */}
      <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-5 mb-10">
        <div className="flex items-center gap-5">
          <img
            src={data.logo}
            alt={`${league} logo`}
            className="w-16 h-16 object-contain"
          />
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-text-primary uppercase">
            {league}
          </h1>
        </div>
        <SeasonSelector
          league={league}
          selectedSeason={selectedSeason}
          onSeasonChange={handleSeasonChange}
        />
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
          {tabs.map((tab, i) => (
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

      {showSlate && <LeagueSlate league={league} />}

      {activeTab === "games" && (
        <DateNavigation
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          gameDates={gameDates}
          gameCounts={gameCounts}
          loading={datesLoading}
          isCurrentSeason={!selectedSeason}
          resetKey={`${league}-${selectedSeason ?? "current"}`}
        />
      )}
      </div>

      <div className={`${contentMaxWidth} mx-auto`}>
      {!displayData && !error ? (
        <LeaguePageSkeleton activeTab={activeTab} league={league} season={selectedSeason} />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
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
              {activeTab === "playoffs" ? (
                <PlayoffsBracket key={selectedSeason} league={league} season={selectedSeason} />
              ) : activeTab === "games" ? (
                <>
                  <AnimatePresence mode="wait">
                    {games.length === 0 ? (
                      <m.div
                        key={`empty-${selectedDate}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 0.2 } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                        className="flex flex-col items-center justify-center py-20 text-text-tertiary"
                      >
                        <svg
                          className="w-10 h-10 mb-4 opacity-40"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p className="text-sm">No games scheduled for this date.</p>
                      </m.div>
                    ) : (
                      <m.div
                        key={selectedDate}
                        className="grid grid-cols-1 md:grid-cols-3 gap-5 justify-items-center items-start"
                        variants={containerVariants}
                        initial={animateCards ? "hidden" : false}
                        animate="visible"
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      >
                        {games.map((game) => (
                          <m.div
                            key={game.id}
                            variants={itemVariants}
                            className="w-full"
                          >
                            <GameCard game={game} />
                          </m.div>
                        ))}
                      </m.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <m.div
                  className="grid grid-cols-1 md:grid-cols-2 gap-8"
                  animate={{ opacity: standingsFetching ? 0.5 : 1 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                  {/* East / AFC */}
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-4 text-center">
                      {league === "nfl" ? "AFC" : "Eastern Conference"}
                    </h3>
                    <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                      {renderStandingsRows(standings.eastOrAFC)}
                    </div>
                  </div>

                  {/* West / NFC */}
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-4 text-center">
                      {league === "nfl" ? "NFC" : "Western Conference"}
                    </h3>
                    <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                      {renderStandingsRows(standings.westOrNFC)}
                    </div>
                  </div>
                </m.div>
              )}
            </m.div>
          </AnimatePresence>
        </div>
      )}
      </div>
    </div>
  );
}
