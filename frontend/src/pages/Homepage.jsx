import { Link } from "react-router-dom";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import GameCard from "../components/cards/GameCard.jsx";
import GameCardSkeleton from "../components/skeletons/GameCardSkeleton.jsx";
import leagueData from "../utils/leagueData.js";
import { useHomeGames } from "../hooks/data/useHomeGames.js";
import { containerVariants, itemVariants } from "../utils/motion.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavorites } from "../hooks/user/useFavorites.js";
import { useUserPrefs } from "../hooks/user/useUserPrefs.js";
import FavoritePlayersSection from "../components/favorites/FavoritePlayersSection.jsx";
import FavoriteTeamsSection from "../components/favorites/FavoriteTeamsSection.jsx";
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
  const [tabDirection, setTabDirection] = useState(1);
  const leagueTabRefs = useRef([]);
  const leagueNavRef = useRef(null);
  const [leaguePillBounds, setLeaguePillBounds] = useState(null);

  useLayoutEffect(() => {
    const idx = leagues.findIndex((l) => l.id === activeLeague);
    const btn = leagueTabRefs.current[idx];
    const nav = leagueNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setLeaguePillBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [activeLeague, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userPicked && resolvedLeague) setActiveLeague(resolvedLeague);
  }, [resolvedLeague, userPicked]);

  function pickLeague(id) {
    const order = Object.keys(leagueData);
    setTabDirection(order.indexOf(id) > order.indexOf(activeLeague) ? 1 : -1);
    setActiveLeague(id);
    setUserPicked(true);
  }

  const leagues = Object.entries(leagueData).map(([id, data]) => ({
    id,
    name: data.name,
    logo: data.logo,
  }));

  return (
    <div className="flex flex-col w-full max-w-[1200px] mx-auto px-5 sm:px-8 py-12">

      {/* Hero — always real, no data dependency */}
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
            <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-8 flex flex-col items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-3.5 w-52" />
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
      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading || !activeLeague ? (
        <>
          {/* Skeleton tab pills */}
          <div className="flex justify-center mb-8 gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-full" />
            ))}
          </div>
          {/* Skeleton game grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {Array.from({ length: 6 }).map((_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        </>
      ) : (
        <div>
          {/* Tab pills */}
          <div className="flex justify-center mb-8">
            <div ref={leagueNavRef} className="relative flex gap-0 bg-surface-elevated border border-white/[0.08] rounded-full p-1">
              {leaguePillBounds && (
                <m.div
                  className="absolute inset-y-1 rounded-full bg-accent/15 border border-accent/25 pointer-events-none"
                  initial={{ left: leaguePillBounds.left, width: leaguePillBounds.width }}
                  animate={{ left: leaguePillBounds.left, width: leaguePillBounds.width }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              {leagues.map((league, i) => (
                <button
                  key={league.id}
                  ref={(el) => (leagueTabRefs.current[i] = el)}
                  onClick={() => pickLeague(league.id)}
                  className="relative flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-medium z-10 transition-colors duration-200"
                  style={{ color: activeLeague === league.id ? "var(--color-accent)" : "var(--color-text-secondary)" }}
                >
                  <img src={league.logo} alt={league.name} className="w-5 h-5 object-contain" />
                  <span>{league.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Games grid */}
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={tabDirection} initial={false}>
              <m.div
                key={activeLeague}
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
                <m.div
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
              </m.div>
            </AnimatePresence>
          </div>

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
        </div>
      )}
    </div>
  );
}
