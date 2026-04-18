import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { m } from "framer-motion";
import { usePlayer } from "../hooks/data/usePlayer.js";
import { useSeasonParam } from "../hooks/useSeasonParam.js";
import buildSeasonUrl from "../utils/buildSeasonUrl.js";
import { queryKeys, queryFns } from "../lib/query.js";
import { containerVariants, itemVariants } from "../utils/motion.js";
import PlayerPageSkeleton from "../components/skeletons/PlayerPageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";

import PlayerAvgCard from "../components/cards/PlayerAvgCard.jsx";
import SimilarPlayersCard from "../components/cards/SimilarPlayersCard.jsx";
import PlayerStatusBadge from "../components/player/PlayerStatusBadge.jsx";
import slugify from "../utils/slugify.js";
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

export default function PlayerPage() {
  const { league, playerId: slug } = useParams();
  const [searchParams] = useSearchParams();
  const urlSeason = searchParams.get("season") || null;
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(null);
  const { playerData, loading, seasonLoading, error, retry } = usePlayer(league, slug, urlSeason);
  const { seasons: leagueSeasons } = useSeasons(league);
  const [selectedSeason, setSelectedSeason] = useSeasonParam(playerData?.availableSeasons ?? [], leagueSeasons[0] ?? null);

  useEffect(() => {
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
    setSelectedMonth(months[months.length - 1]);
  }, [playerData?.games]);
  const { session, openAuthModal } = useAuth();
  const { isFavorited, toggle } = useFavoriteToggle("player", session ? playerData?.id : null);

  const filteredGames = useMemo(() => {
    if (!playerData?.games) return [];
    if (!selectedMonth) return playerData.games;
    return playerData.games.filter((g) => String(g.date).slice(0, 7) === selectedMonth);
  }, [playerData, selectedMonth]);

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

  const { name, position, jerseyNumber, height, weight, imageUrl, seasonAverages, season: apiSeason, team, dob, draftInfo, status, statusDescription, currentSeason } = playerData;
  const viewingCurrentSeason = (selectedSeason || apiSeason) === currentSeason;

  return (
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

      {/* Player header + info + sidebar */}
      <div className="flex flex-col lg:flex-row gap-8 mb-12">
        {/* Left: headshot + info card */}
        <div className="flex flex-col md:flex-row flex-1 gap-8 min-w-0">
        {/* Headshot + name */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary text-center md:text-left">
              {name}
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
          <img
            src={imageUrl || "/images/placeholder.png"}
            alt={name}
            className="w-56 h-56 object-cover rounded-3xl ring-1 ring-white/[0.08]"
          />
        </div>

        {/* Info card */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {viewingCurrentSeason ? (
              <PlayerStatusBadge
                status={status}
                title={statusDescription || undefined}
              />
            ) : <span />}
            <div className="flex gap-2 ml-auto">
              <Link
                to={`/compare`}
                state={{ league, type: "players", id1: slugify(name) }}
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
          </div>
          {viewingCurrentSeason && status && statusDescription && (
            <p className="text-xs text-text-secondary leading-snug -mt-3 break-words">
              {statusDescription}
            </p>
          )}
          <div
            className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
            style={{ opacity: seasonLoading ? 0.5 : 1, transition: 'opacity 200ms ease' }}
          >
            <div className="grid grid-cols-[max-content_auto] gap-x-10 gap-y-3">
              <span className="text-sm text-text-tertiary">Height / Weight</span>
              <span className="text-sm font-medium text-text-primary">{height} / {weight}</span>
              <span className="text-sm text-text-tertiary">Position</span>
              <span className="text-sm font-medium text-text-primary">{position}</span>
              <span className="text-sm text-text-tertiary">Jersey</span>
              <span className="text-sm font-semibold text-text-primary">#{jerseyNumber}</span>
              <span className="text-sm text-text-tertiary">Birthdate</span>
              <span className="text-sm font-medium text-text-primary">{formatDate(dob)}</span>
              <span className="text-sm text-text-tertiary">Draft</span>
              <span className="text-sm font-medium text-text-primary">{draftInfo}</span>
              <span className="text-sm text-text-tertiary">Team</span>
              <Link
                to={buildSeasonUrl(`/${league}/teams/${slugify(team.name)}`, selectedSeason)}
                className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors duration-200"
                onMouseEnter={() => {
                  if (window.matchMedia("(hover: hover)").matches) {
                    queryClient.prefetchQuery({ queryKey: queryKeys.team(league, slugify(team.name)), queryFn: queryFns.team(league, slugify(team.name)), staleTime: 10_000 });
                  }
                }}
              >
                {team.name}
              </Link>
            </div>
          </div>

          <div style={{ opacity: seasonLoading ? 0.5 : 1, transition: 'opacity 200ms ease' }}>
            <PlayerAvgCard league={league} averages={seasonAverages} season={selectedSeason || apiSeason} />
          </div>
        </div>
        </div>{/* end left: headshot + info card */}

        {/* Similar Players sidebar — self-sizing, collapses when empty */}
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
          onMonthChange={setSelectedMonth}
        />
        <div style={{ opacity: seasonLoading ? 0.5 : 1, transition: 'opacity 200ms ease' }}>
        {filteredGames.length > 0 ? (
          <m.div
            key={selectedSeason || apiSeason}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
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
                <m.div key={i} variants={itemVariants}>
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
                  />
                </m.div>
              );
            })}
          </m.div>
        ) : (
          <p className="text-center text-text-tertiary text-sm mt-8">
            {playerData?.games?.length > 0
              ? "No games this month."
              : "No recent performances to show."}
          </p>
        )}
        </div>
      </div>
    </div>
  );
}
