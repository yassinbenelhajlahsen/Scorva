import { Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import GameCard from "../components/cards/GameCard.jsx";
import LoadingPage from "./LoadingPage.jsx";
import leagueData from "../utilities/LeagueData.js";
import { useHomeGames } from "../hooks/useHomeGames.js";
import { containerVariants, itemVariants } from "../utilities/motion.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useFavorites } from "../hooks/useFavorites.js";
import FavoritePlayersSection from "../components/favorites/FavoritePlayersSection.jsx";
import FavoriteTeamsSection from "../components/favorites/FavoriteTeamsSection.jsx";

export default function Homepage() {
  const { games, loading, error } = useHomeGames();
  const [activeLeague, setActiveLeague] = useState("nba");
  const { session } = useAuth();
  const { favorites, loading: favLoading } = useFavorites();

  if (loading) return <LoadingPage />;
  if (error) return <div className="p-6 text-loss text-sm">{error}</div>;

  const leagues = Object.entries(leagueData).map(([id, data]) => ({
    id,
    name: data.name,
    logo: data.logo,
  }));

  return (
    <div className="flex flex-col w-full max-w-[1200px] mx-auto px-5 sm:px-8 py-12">

      {/* Hero */}
      <motion.div
        className="text-center mb-14 mt-2"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-text-primary">
          Scorva
        </h1>
        <p className="text-base sm:text-lg text-text-secondary max-w-xl mx-auto mt-4 leading-relaxed">
          Real-time scores, stats, and insights across NBA, NFL, and NHL.
        </p>
      </motion.div>

      {/* Favorites section — only visible when logged in */}
      {session && (
        <div className="mb-14">
          {favLoading || !favorites ? (
            <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-8 text-center">
              <p className="text-text-tertiary text-sm">Loading your favorites…</p>
            </div>
          ) : favorites.players.length === 0 && favorites.teams.length === 0 ? (
            <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-8 text-center">
              <svg className="w-8 h-8 mx-auto mb-3 text-yellow-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
              <p className="text-text-secondary text-sm font-medium">Star teams or players to see them here</p>
            </div>
          ) : (
            <motion.div
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
            </motion.div>
          )}
        </div>
      )}

      {/* League tabs + Games */}
      <div>
        {/* Tab pills */}
        <div className="flex justify-center mb-8 gap-2">
          {leagues.map((league) => (
            <button
              key={league.id}
              onClick={() => setActiveLeague(league.id)}
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
        <motion.div
          key={activeLeague}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {games[activeLeague].slice(0, 6).map((game) => (
            <motion.div key={game.id} variants={itemVariants} className="w-full">
              <GameCard game={game} />
            </motion.div>
          ))}
        </motion.div>

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
    </div>
  );
}
