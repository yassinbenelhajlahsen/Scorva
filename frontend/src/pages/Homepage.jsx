import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../lib/query.js";
import { m, AnimatePresence } from "framer-motion";
import GameCard from "../components/cards/GameCard.jsx";
import GameCardSkeleton from "../components/skeletons/GameCardSkeleton.jsx";
import leagueData from "../utils/leagueData.js";
import { useHomeGames } from "../hooks/data/useHomeGames.js";
import { containerVariants, itemVariants } from "../utils/motion.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUserPrefs } from "../hooks/user/useUserPrefs.js";
import ErrorState from "../components/ui/ErrorState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import NewsSection from "../components/news/NewsSection.jsx";

export default function Homepage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { games, loading, error, retry } = useHomeGames();
  const { session } = useAuth();
  const { prefs, loading: prefsLoading } = useUserPrefs();

  // Resolve the active league: wait for prefs when logged in, default to "nba" when not
  const resolvedLeague = session === undefined || (session && (prefsLoading || prefs === null))
    ? null  // still loading — don't commit yet
    : prefs?.default_league ?? "nba";

  const [activeLeague, setActiveLeague] = useState(null);
  const [userPicked, setUserPicked] = useState(false);
  const [tabDirection, setTabDirection] = useState(1);

  const tabNavRef = useRef(null);
  const tabRefs = useRef([]);
  const [indicatorBounds, setIndicatorBounds] = useState(null);

  useLayoutEffect(() => {
    if (!activeLeague || loading) return;
    const idx = leagues.findIndex((l) => l.id === activeLeague);
    const btn = tabRefs.current[idx];
    const nav = tabNavRef.current;
    if (btn && nav) {
      const btnRect = btn.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setIndicatorBounds({ left: btnRect.left - navRect.left, width: btnRect.width });
    }
  }, [activeLeague, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userPicked && resolvedLeague) setActiveLeague(resolvedLeague);
  }, [resolvedLeague, userPicked]);

  function pickLeague(id) {
    if (id === activeLeague) {
      navigate(`/${id}`);
      return;
    }
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

      {/* News Headlines */}
      <NewsSection />

      {/* League tabs + Games */}
      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading || !activeLeague ? (
        <>
          {/* Skeleton header row */}
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-3.5 w-32" />
            <div className="flex gap-1 border-b border-white/[0.06]">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-4 w-14 mx-3 mb-2.5 mt-2" />
              ))}
            </div>
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
          {/* Section header with inline league tabs */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs uppercase tracking-widest text-text-tertiary font-semibold">
              Today's Games
            </h2>
            <div ref={tabNavRef} className="relative flex border-b border-white/[0.06]">
              {indicatorBounds && (
                <m.div
                  className="absolute bottom-0 h-0.5 bg-accent pointer-events-none"
                  animate={{ left: indicatorBounds.left, width: indicatorBounds.width }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              {leagues.map((league, i) => {
                const isActive = activeLeague === league.id;
                return (
                  <button
                    key={league.id}
                    ref={(el) => (tabRefs.current[i] = el)}
                    onClick={() => pickLeague(league.id)}
                    className={`relative flex items-center gap-2 px-3 pb-2.5 pt-2 text-sm font-medium transition-colors duration-150 -mb-px cursor-pointer ${isActive ? "text-accent" : "text-text-secondary hover:text-text-primary"}`}
                  >
                    <img src={league.logo} alt={league.name} className="w-4 h-4 object-contain" />
                    <span>{league.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Games grid */}
          <div className="overflow-x-clip">
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
              onMouseEnter={() => {
                queryClient.prefetchQuery({ queryKey: queryKeys.leagueGames(activeLeague, null, null), queryFn: queryFns.leagueGames(activeLeague, null, null), staleTime: 10_000 });
                queryClient.prefetchQuery({ queryKey: queryKeys.gameDates(activeLeague, null), queryFn: queryFns.gameDates(activeLeague, null), staleTime: 10_000 });
              }}
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
