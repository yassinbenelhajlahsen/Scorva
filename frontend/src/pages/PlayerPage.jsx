import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { usePlayer } from "../hooks/usePlayer.js";
import { containerVariants, itemVariants } from "../utilities/motion.js";
import PlayerPageSkeleton from "../components/skeletons/PlayerPageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";

import PlayerAvgCard from "../components/cards/PlayerAvgCard.jsx";
import slugify from "../utilities/slugify.js";
import formatDate from "../utilities/formatDate.js";
import StatCard from "../components/cards/StatCard.jsx";
import SeasonSelector from "../components/ui/SeasonSelector.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavoriteToggle } from "../hooks/useFavoriteToggle.js";

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
  const [selectedSeason, setSelectedSeason] = useState(searchParams.get("season") || null);
  const { playerData, loading, error, retry } = usePlayer(league, slug, selectedSeason);
  const { session } = useAuth();
  const { isFavorited, toggle } = useFavoriteToggle("player", session ? playerData?.id : null);

  if (loading) return <PlayerPageSkeleton />;
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

  const { id, name, position, jerseyNumber, height, weight, imageUrl, seasonAverages, season: apiSeason, team, dob, draftInfo } = playerData;

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <Link
        to={`/${league}`}
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{league?.toUpperCase()}</span>
      </Link>

      {/* Player header + info */}
      <div className="flex flex-col md:flex-row gap-8 mb-12">
        {/* Headshot + name */}
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary text-center md:text-left">
              {name}
            </h1>
            {session && (
              <button
                onClick={toggle}
                aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                className="transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <svg className={`w-7 h-7 ${isFavorited ? "fill-yellow-400 text-yellow-400" : "fill-none text-text-tertiary hover:text-yellow-400"}`} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
              </button>
            )}
          </div>
          <img
            src={imageUrl || "/images/placeholder.png"}
            alt={name}
            className="w-56 h-56 object-cover rounded-3xl ring-1 ring-white/[0.08]"
          />
        </div>

        {/* Info card */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex justify-end">
            <SeasonSelector
              league={league}
              selectedSeason={selectedSeason}
              onSeasonChange={setSelectedSeason}
            />
          </div>
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
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
                to={`/${league}/teams/${slugify(team.name)}${selectedSeason ? `?season=${selectedSeason}` : ""}`}
                className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors duration-200"
              >
                {team.name}
              </Link>
            </div>
          </div>

          <PlayerAvgCard league={league} averages={seasonAverages} season={selectedSeason || apiSeason} />
        </div>
      </div>

      {/* Recent Performances */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-8">
          Recent Performances
        </h2>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {playerData?.games?.map((game, i) => {
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
              <motion.div key={i} variants={itemVariants}>
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
                  id={id}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
