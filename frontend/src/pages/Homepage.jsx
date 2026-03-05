import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import GameCard from "../components/cards/GameCard.jsx";
import LoadingPage from "./LoadingPage.jsx";
import leagueData from "../utilities/LeagueData.js";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export default function Homepage() {
  const [games, setGames] = useState({ nba: [], nhl: [], nfl: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeLeague, setActiveLeague] = useState("nba");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAllGames() {
      try {
        setLoading(true);
        setError(null);
        const leagues = ["nba", "nhl", "nfl"];
        const responses = await Promise.all(
          leagues.map((league) =>
            fetch(`${import.meta.env.VITE_API_URL}/api/${league}/games`, {
              signal: controller.signal,
            })
          )
        );
        const data = await Promise.all(
          responses.map((res, i) => {
            if (!res.ok) throw new Error(`Failed to fetch ${leagues[i]} games`);
            return res.json();
          })
        );
        setGames({ nba: data[0], nhl: data[1], nfl: data[2] });
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Could not load games. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAllGames();
    return () => controller.abort();
  }, []);

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
