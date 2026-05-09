import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "../hooks/data/usePlayer.js";
import { useSeasonParam } from "../hooks/useSeasonParam.js";
import buildSeasonUrl from "../utils/buildSeasonUrl.js";
import { queryKeys, queryFns } from "../lib/query.js";
import PlayerPageSkeleton from "../components/skeletons/PlayerPageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import { PullToRefresh } from "../components/ui/PullToRefresh.jsx";

import PlayerAwardsCard from "../components/cards/PlayerAwardsCard.jsx";
import SimilarPlayersCard from "../components/cards/SimilarPlayersCard.jsx";
import PlayerStatusBadge from "../components/player/PlayerStatusBadge.jsx";
import StreakBadge from "../components/ui/StreakBadge.jsx";
import PlayerRatingsSection from "../components/player/PlayerRatingsSection.jsx";
import { useStreak } from "../hooks/data/useStreak.js";
import teamUrl from "../utils/teamUrl.js";
import formatDate from "../utils/formatDate.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavoriteToggle } from "../hooks/user/useFavoriteToggle.js";
import { useSeasons } from "../hooks/data/useSeasons.js";

export default function PlayerDetailPage() {
  const { league, playerId: slug } = useParams();
  const [searchParams] = useSearchParams();
  const urlSeason = searchParams.get("season") || null;
  const queryClient = useQueryClient();
  const { playerData, loading, seasonLoading, error, retry, refetch } = usePlayer(league, slug, urlSeason);

  const { seasons: leagueSeasons } = useSeasons(league);
  const [selectedSeason] = useSeasonParam(playerData?.availableSeasons ?? [], leagueSeasons[0] ?? null);

  const { session, openAuthModal } = useAuth();
  const { isFavorited, toggle } = useFavoriteToggle("player", session ? playerData?.id : null);

  const apiSeason = playerData?.season;
  const currentSeason = playerData?.currentSeason;
  const viewingCurrentSeason = (selectedSeason || apiSeason) === currentSeason;
  const { streak } = useStreak(league, "player", playerData?.id, {
    enabled: viewingCurrentSeason,
  });

  const handleRefresh = async () => {
    await refetch();
  };

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

  const { name, position, jerseyNumber, height, weight, imageUrl, team, dob, draftInfo, status, statusDescription } = playerData;
  const playerHref = buildSeasonUrl(`/${league}/players/${slug}`, selectedSeason);
  const ratingsAvailable = league?.toLowerCase() === "nba";

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="max-w-[1500px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link to player page */}
      <Link
        to={playerHref}
        onMouseEnter={() => {
          if (window.matchMedia("(hover: hover)").matches) {
            queryClient.prefetchQuery({
              queryKey: queryKeys.player(league, slug, urlSeason),
              queryFn: queryFns.player(league, slug, urlSeason),
              staleTime: 10_000,
            });
          }
        }}
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>{name}</span>
      </Link>

      {/* Player header + info + sidebar */}
      <div className="flex flex-col lg:flex-row gap-8 mb-12">
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
                className="touch-target transition-all duration-200 hover:scale-110 active:scale-95"
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
            {viewingCurrentSeason && (
              <div className="flex flex-wrap items-center gap-2">
                <PlayerStatusBadge
                  status={status}
                  title={statusDescription || undefined}
                />
                <StreakBadge streak={streak} />
              </div>
            )}
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
                  to={buildSeasonUrl(teamUrl(league, team), selectedSeason)}
                  className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors duration-200"
                >
                  {team.name}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Similar Players sidebar */}
        <SimilarPlayersCard league={league} slug={slug} season={selectedSeason || apiSeason} />
      </div>

      {/* Career Honors */}
      <PlayerAwardsCard awards={playerData.awards} />

      {/* Player Ratings (NBA only — top-performances supports nba in v1) */}
      {ratingsAvailable && (
        <PlayerRatingsSection league={league} playerId={slug} />
      )}
    </div>
    </PullToRefresh>
  );
}
