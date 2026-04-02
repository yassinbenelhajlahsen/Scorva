import { useParams, Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { m } from "framer-motion";

import GameCard from "../components/cards/GameCard";
import SeasonSelector from "../components/ui/SeasonSelector.jsx";
import { useTeam } from "../hooks/useTeam.js";
import { containerVariants, itemVariants } from "../utilities/motion.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavoriteToggle } from "../hooks/useFavoriteToggle.js";
import TeamPageSkeleton from "../components/skeletons/TeamPageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";

export default function TeamPage() {
  const { league: rawLeague, teamId } = useParams();
  const league = (rawLeague || "").toLowerCase();
  const [searchParams] = useSearchParams();
  const [selectedSeason, setSelectedSeason] = useState(searchParams.get("season") || null);
  const { team, games, teamRecord, loading, error, retry } = useTeam(league, teamId, selectedSeason);
  const { session } = useAuth();
  const { isFavorited, toggle } = useFavoriteToggle("team", session ? team?.id : null);

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
          to={`/${league}${selectedSeason ? `?season=${selectedSeason}` : ""}`}
          className="bg-accent text-white font-semibold py-3 px-6 rounded-full text-sm transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(232,134,58,0.3)]"
        >
          {league?.toUpperCase()} Teams
        </Link>
      </div>
    );
  }

  return (
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

      {/* Season selector */}
      <div className="flex justify-end mb-6">
        <SeasonSelector
          league={league}
          selectedSeason={selectedSeason}
          onSeasonChange={setSelectedSeason}
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
            src={team.logo_url || "/images/placeholder.png"}
            alt={team.name}
            className="w-44 h-44 object-contain"
          />
        </div>

        {/* Stats card */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="grid grid-cols-2 gap-x-10 content-between h-full">
              <span className="text-sm text-text-tertiary">Location</span>
              <span className="text-sm font-medium text-text-primary">{team.location}</span>
              <span className="text-sm text-text-tertiary">Record</span>
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                {teamRecord ?? team.record}
              </span>
              {!selectedSeason && (
                <>
                  <span className="text-sm text-text-tertiary">Home Record</span>
                  <span className="text-sm font-medium text-text-primary tabular-nums">{team.homerecord}</span>
                  <span className="text-sm text-text-tertiary">Away Record</span>
                  <span className="text-sm font-medium text-text-primary tabular-nums">{team.awayrecord}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Games */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-8">
          {selectedSeason ? `${selectedSeason} Schedule` : "Season Schedule"}
        </h2>
        {games.length > 0 ? (
          <m.div
            className="grid grid-cols-1 md:grid-cols-2 gap-5 justify-items-center items-start"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {games.map((game) => (
              <m.div key={game.id} variants={itemVariants} className="w-full">
                <GameCard game={game} />
              </m.div>
            ))}
          </m.div>
        ) : (
          <p className="text-center text-text-tertiary text-sm mt-8">
            No recent games to show.
          </p>
        )}
      </div>
    </div>
  );
}
