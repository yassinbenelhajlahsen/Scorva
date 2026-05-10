import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { usePlayer } from "../hooks/data/usePlayer.js";
import { useSeasonParam } from "../hooks/useSeasonParam.js";
import buildSeasonUrl from "../utils/buildSeasonUrl.js";
import { monthSlideVariants, monthSlideItemVariants } from "../utils/motion.js";
import PlayerPageSkeleton from "../components/skeletons/PlayerPageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import { PullToRefresh } from "../components/ui/PullToRefresh.jsx";
import { SwipeableTabs } from "../components/ui/SwipeableTabs.jsx";

import PlayerAvgCard from "../components/cards/PlayerAvgCard.jsx";
import PlayerAwardsCard from "../components/cards/PlayerAwardsCard.jsx";
import SimilarPlayersCard from "../components/cards/SimilarPlayersCard.jsx";
import PlayerHero from "../components/player/PlayerHero.jsx";
import PlayerRatingsSection from "../components/player/PlayerRatingsSection.jsx";
import { useStreak } from "../hooks/data/useStreak.js";
import { usePlayerRankings } from "../hooks/data/usePlayerRankings.js";
import formatDate from "../utils/formatDate.js";
import StatCard from "../components/cards/StatCard.jsx";
import SeasonSelector from "../components/navigation/SeasonSelector.jsx";
import MonthNavigation from "../components/navigation/MonthNavigation.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavoriteToggle } from "../hooks/user/useFavoriteToggle.js";
import { useSeasons } from "../hooks/data/useSeasons.js";

const statConfigs = {
  nba: [
    { key: "points",    label: "PTS" },
    { key: "rebounds",  label: "REB" },
    { key: "assists",   label: "AST" },
    { key: "fg",        label: "FG" },
    { key: "threept",   label: "3PT" },
    { key: "ft",        label: "FT" },
    { key: "turnovers", label: "TO" },
    { key: "plusminus", label: "+/-" },
    { key: "minutes",   label: "MINS" },
  ],
  nfl: [
    { key: "CMPATT", label: "CMPATT" },
    { key: "YDS",    label: "YDS" },
    { key: "TD",     label: "TD" },
    { key: "INT",    label: "INT" },
    { key: "SACK",   label: "SACK" },
  ],
  nhl: [
    { key: "G",         label: "G" },
    { key: "A",         label: "A" },
    { key: "HT",        label: "HT" },
    { key: "plusminus", label: "+/-" },
    { key: "TOI",       label: "TOI" },
    { key: "SAVES",     label: "SV" },
    { key: "SPCT",      label: "SV%" },
    { key: "GA",        label: "GA" },
  ],
};

const nhlStatsByPosition = {
  G: ["SAVES", "SPCT", "GA", "TOI"],
};

// Which NFL stats are relevant per position group
const nflStatsByPosition = {
  QB:  ["CMPATT", "YDS", "TD", "INT"],
  RB:  ["YDS", "TD"],
  FB:  ["YDS", "TD"],
  WR:  ["YDS", "TD"],
  TE:  ["YDS", "TD"],
  DE:  ["SACK"],
  DT:  ["SACK"],
  LB:  ["SACK", "INT"],
  OLB: ["SACK", "INT"],
  ILB: ["SACK"],
  MLB: ["SACK"],
  CB:  ["INT"],
  S:   ["INT"],
  FS:  ["INT"],
  SS:  ["INT"],
  DB:  ["INT"],
  SAF: ["INT"],
};

const TABS = [
  { id: "profile",    label: "Profile" },
  { id: "highlights", label: "Highlights" },
];
const ALLOWED_TABS = new Set(TABS.map((t) => t.id));

export default function PlayerPage() {
  const { league, playerId: slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSeason = searchParams.get("season") || null;
  const tabParam = searchParams.get("tab");
  const tab = ALLOWED_TABS.has(tabParam) ? tabParam : "profile";
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthDirection, setMonthDirection] = useState(0);
  const { playerData, loading, seasonLoading, error, retry, refetch } = usePlayer(league, slug, urlSeason);

  const handleMonthChange = (newMonth) => {
    setMonthDirection(newMonth > selectedMonth ? 1 : -1);
    setSelectedMonth(newMonth);
  };

  const handleRefresh = async () => {
    await refetch();
  };
  const { seasons: leagueSeasons } = useSeasons(league);
  const [selectedSeason, setSelectedSeason] = useSeasonParam(playerData?.availableSeasons ?? [], leagueSeasons[0] ?? null);

  useEffect(() => {
    setMonthDirection(0);
    setSelectedMonth(null);
  }, [selectedSeason]);

  useEffect(() => {
    if (!playerData) return;
    // If no season was explicitly selected and the resolved season has no stats
    // (e.g. a retired player), jump to the most recent season with stats.
    if (!selectedSeason && playerData.availableSeasons?.length > 0 &&
        !playerData.availableSeasons.includes(playerData.season)) {
      setSelectedSeason(playerData.availableSeasons[0]);
    }
  }, [playerData, selectedSeason, setSelectedSeason]);

  useEffect(() => {
    if (!playerData?.games?.length) return;
    const months = [...new Set(playerData.games.map((g) => String(g.date).slice(0, 7)))].sort();
    setMonthDirection(0);
    setSelectedMonth(months[months.length - 1]);
  }, [playerData?.games]);
  const { session, openAuthModal } = useAuth();
  const { isFavorited, toggle } = useFavoriteToggle("player", session ? playerData?.id : null);

  const filteredGames = useMemo(() => {
    if (!playerData?.games) return [];
    if (!selectedMonth) return playerData.games;
    return playerData.games.filter((g) => String(g.date).slice(0, 7) === selectedMonth);
  }, [playerData, selectedMonth]);

  const apiSeason = playerData?.season;
  const currentSeason = playerData?.currentSeason;
  const viewingCurrentSeason = (selectedSeason || apiSeason) === currentSeason;
  const { streak } = useStreak(league, "player", playerData?.id, {
    enabled: viewingCurrentSeason,
  });
  const rankings = usePlayerRankings(league, slug);

  // Tab pill sliding-underline indicator
  const tabNavRef = useRef(null);
  const tabRefs = useRef([]);
  const [tabBounds, setTabBounds] = useState(null);
  useLayoutEffect(() => {
    const idx = TABS.findIndex((t) => t.id === tab);
    const btn = tabRefs.current[idx];
    const nav = tabNavRef.current;
    if (btn && nav) {
      const b = btn.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      setTabBounds({ left: b.left - n.left, width: b.width });
    }
  }, [tab]);

  function setTab(next) {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (!next || next === "profile") sp.delete("tab");
        else sp.set("tab", next);
        return sp;
      },
      { replace: true },
    );
  }

  if (loading) return <PlayerPageSkeleton slug={slug} league={league} />;
  if (error) return <ErrorState message={error} onRetry={retry} />;

  if (!playerData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">Player Not Found</h1>
        <p className="text-text-secondary text-sm mb-8 text-center max-w-md">
          The player you&apos;re looking for doesn&apos;t exist or hasn&apos;t been added yet.
        </p>
        <Link
          to={`/${league}`}
          className="bg-accent text-white font-semibold py-3 px-6 rounded-full text-sm transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(232,134,58,0.3)]"
        >
          Back to {league?.toUpperCase()}
        </Link>
      </div>
    );
  }

  const { name, position, jerseyNumber, height, weight, imageUrl, seasonAverages, team, dob, draftInfo, status, statusDescription } = playerData;
  const ratingsAvailable = league?.toLowerCase() === "nba";

  const profileContent = (
    <div>
      {/* Compare + season-selector row */}
      <div className="flex justify-end gap-2 mb-4">
        <Link
          to={`/compare`}
          state={{ league, type: "players", id1: slug }}
          className="inline-flex items-center gap-1.5 appearance-none bg-surface-elevated border border-white/[0.08] rounded-xl text-text-primary text-sm font-medium px-4 py-2 cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:bg-surface-overlay"
          aria-label="Compare player"
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
          seasons={playerData.availableSeasons}
        />
      </div>
      {viewingCurrentSeason && status && statusDescription && (
        <p className="text-xs text-text-secondary leading-snug mb-4 break-words">
          {statusDescription}
        </p>
      )}

      {/* Averages + similar players sidebar */}
      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        <div
          className="flex-1 min-w-0"
          style={{ opacity: seasonLoading ? 0.5 : 1, transition: 'opacity 200ms ease' }}
        >
          <PlayerAvgCard league={league} averages={seasonAverages} season={selectedSeason || apiSeason} />
        </div>

        <SimilarPlayersCard league={league} slug={slug} season={selectedSeason || apiSeason} />
      </div>

      {/* Recent Performances */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-6">
          Recent Performances
        </h2>
        <MonthNavigation
          games={playerData?.games}
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
        />
        <div style={{ opacity: seasonLoading ? 0.5 : 1, transition: 'opacity 200ms ease' }}>
          <AnimatePresence mode="wait" custom={monthDirection} initial={false}>
            {filteredGames.length > 0 ? (
              <m.div
                key={`${selectedSeason || apiSeason}-${selectedMonth || "all"}`}
                custom={monthDirection}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                variants={monthSlideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                {filteredGames.map((game, i) => {
                  const key = league?.toLowerCase();
                  let config = statConfigs[key] || [];
                  if (key === "nfl" && position) {
                    const relevant = nflStatsByPosition[position.toUpperCase()];
                    if (relevant) config = config.filter(({ key: k }) => relevant.includes(k));
                  } else if (key === "nhl" && position) {
                    const relevant = nhlStatsByPosition[position.toUpperCase()];
                    if (relevant) config = config.filter(({ key: k }) => relevant.includes(k));
                  }
                  const statsProps = config.map(({ key: statKey, label }) => ({
                    label,
                    value: game[statKey] ?? "0",
                  }));
                  return (
                    <m.div key={i} variants={monthSlideItemVariants}>
                      <StatCard
                        league={league}
                        stats={statsProps}
                        opponent={game.opponent}
                        date={formatDate(game.date)}
                        gameId={game.gameid}
                        isHome={game.ishome}
                        opponentLogo={game.opponentlogo}
                        result={game.result}
                        status={game.status}
                        playerName={name}
                        gameType={game.type}
                        gameLabel={game.game_label}
                        ratingGrade={game.ratingGrade}
                      />
                    </m.div>
                  );
                })}
              </m.div>
            ) : (
              <m.p
                key={`empty-${selectedSeason || apiSeason}-${selectedMonth || "all"}`}
                custom={monthDirection}
                variants={monthSlideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="text-center text-text-tertiary text-sm mt-8"
              >
                {playerData?.games?.length > 0
                  ? "No games this month."
                  : "No recent performances to show."}
              </m.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  const highlightsContent = (
    <div className="flex flex-col gap-12">
      {ratingsAvailable && (
        <PlayerRatingsSection league={league} playerId={slug} />
      )}
      <PlayerAwardsCard awards={playerData.awards} />
    </div>
  );

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="max-w-[1500px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <Link
        to={buildSeasonUrl(`/${league}`, selectedSeason)}
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{league?.toUpperCase()}</span>
      </Link>

      <PlayerHero
        league={league}
        name={name}
        imageUrl={imageUrl}
        team={team}
        jerseyNumber={jerseyNumber}
        position={position}
        height={height}
        weight={weight}
        dob={dob}
        draftInfo={draftInfo}
        status={status}
        statusDescription={statusDescription}
        streak={streak}
        showStatus={viewingCurrentSeason}
        isFavorited={isFavorited}
        onToggleFavorite={() => (session ? toggle() : openAuthModal("favorites"))}
        selectedSeason={selectedSeason}
        rankings={rankings}
      />

      {/* Tab strip with sliding underline */}
      <div ref={tabNavRef} className="relative flex border-b border-white/[0.06] mb-8">
        {tabBounds && (
          <m.div
            className="absolute bottom-0 h-0.5 bg-accent pointer-events-none"
            animate={{ left: tabBounds.left, width: tabBounds.width }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        {TABS.map((t, i) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => (tabRefs.current[i] = el)}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-2 px-3 pb-2.5 pt-2 text-sm font-medium transition-colors duration-150 -mb-px cursor-pointer ${
                isActive ? "text-accent" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <SwipeableTabs
        activeId={tab}
        onChange={setTab}
        tabs={[
          { id: "profile",    content: profileContent },
          { id: "highlights", content: highlightsContent },
        ]}
        className="py-1"
      />
    </div>
    </PullToRefresh>
  );
}
