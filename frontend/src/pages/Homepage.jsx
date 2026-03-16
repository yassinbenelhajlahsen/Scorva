import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { m } from "framer-motion";
import GameCard from "../components/cards/GameCard.jsx";
import leagueData from "../utilities/LeagueData.js";
import { useHomeGames } from "../hooks/useHomeGames.js";
import { containerVariants, itemVariants } from "../utilities/motion.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavorites } from "../hooks/useFavorites.js";
import { useUserPrefs } from "../hooks/useUserPrefs.js";
import FavoritePlayersSection from "../components/favorites/FavoritePlayersSection.jsx";
import FavoriteTeamsSection from "../components/favorites/FavoriteTeamsSection.jsx";
import HomepageSkeleton from "../components/skeletons/HomepageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";

export default function Homepage() {
  const { games, loading, error, retry } = useHomeGames();
  const { session } = useAuth();
  const { favorites, loading: favLoading } = useFavorites();
  const { prefs, loading: prefsLoading } = useUserPrefs();

  // Resolve the active league: wait for prefs when logged in, default to "nba" when not
  const resolvedLeague = session === undefined || (session && (prefsLoading || prefs === null))
    ? null  // still loading — don't commit yet
    : prefs?.default_league ?? "nba";

  const [activeLeague, setActiveLeague] = useState(null);
  const [userPicked, setUserPicked] = useState(false);

  useEffect(() => {
    if (!userPicked && resolvedLeague) setActiveLeague(resolvedLeague);
  }, [resolvedLeague, userPicked]);

  function pickLeague(id) {
    setActiveLeague(id);
    setUserPicked(true);
  }

  if (loading) return <HomepageSkeleton session={session} />;
  if (error) return <ErrorState message={error} onRetry={retry} />;

  const leagues = Object.entries(leagueData).map(([id, data]) => ({
    id,
    name: data.name,
    logo: data.logo,
  }));

  return (
    <div className="flex flex-col w-full max-w-[1200px] mx-auto px-5 sm:px-8 py-12">

      {/* Hero */}
      <div className="text-center mb-20 mt-8">
        <h1 className="animate-hero-up font-bold leading-[0.95] tracking-[-0.04em] bg-gradient-to-br from-white via-[#f0ece6] to-[#e8863a] bg-clip-text text-transparent text-[4.5rem] sm:text-[6.5rem] lg:text-[8rem]">
          Scorva
        </h1>
        <p className="animate-hero-up [animation-delay:0.14s] text-base sm:text-[1.0625rem] text-text-secondary max-w-[460px] mx-auto mt-8 leading-[1.65] tracking-[-0.005em]">
          Real-time scores, stats, and insights across NBA, NFL, and NHL.
        </p>
      </div>

      {/* Favorites section — only visible when logged in */}
      {session && (
        <div className="mb-14">
          {favLoading || !favorites ? (
            <div className="flex flex-col gap-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 flex flex-col sm:flex-row gap-5 items-stretch"
                >
                  <div className="flex items-center gap-4 shrink-0 w-full sm:w-52">
                    <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />
                    <div className="flex flex-col gap-2 flex-1">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="hidden sm:block w-px bg-white/[0.06] self-stretch shrink-0" />
                  <div className="flex gap-3 flex-1 min-w-0">
                    {[0, 1].map((j) => (
                      <Skeleton key={j} className="flex-1 min-w-[8rem] h-24 rounded-2xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : favorites.players.length === 0 && favorites.teams.length === 0 ? (
            <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-8 text-center">
              <svg className="w-8 h-8 mx-auto mb-3 text-yellow-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
              <p className="text-text-secondary text-sm font-medium">Star teams or players to see them here</p>
            </div>
          ) : (
            <m.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-8"
            >
              {favorites.players.length > 0 && (
                <FavoritePlayersSection players={favorites.players} />
              )}

              {favorites.teams.length > 0 && (
                <FavoriteTeamsSection teams={favorites.teams} />
              )}
            </m.div>
          )}
        </div>
      )}

      {/* League tabs + Games */}
      {activeLeague && <div>
        {/* Tab pills */}
        <div className="flex justify-center mb-8 gap-2">
          {leagues.map((league) => (
            <button
              key={league.id}
              onClick={() => pickLeague(league.id)}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                activeLeague === league.id
                  ? "bg-accent/15 text-accent border border-accent/25"
                  : "bg-transparent text-text-secondary border border-white/[0.08] hover:text-text-primary hover:border-white/[0.14]"
              }`}
            >
              <img src={league.logo} alt={league.name} className="w-5 h-5 object-contain" />
              <span>{league.name}</span>
            </button>
          ))}
        </div>

        {/* Games grid */}
        <m.div
          key={activeLeague}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {games[activeLeague].slice(0, 6).map((game) => (
            <m.div key={game.id} variants={itemVariants} className="w-full">
              <GameCard game={game} />
            </m.div>
          ))}
        </m.div>

        {/* View All */}
        <div className="flex justify-center mt-10">
          <Link
            to={`/${activeLeague}`}
            className="inline-flex items-center gap-2 bg-accent text-white font-semibold px-6 py-3 rounded-full transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_24px_rgba(232,134,58,0.3)] text-sm"
          >
            <span>View All {activeLeague.toUpperCase()} Games</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>}
    </div>
  );
}
