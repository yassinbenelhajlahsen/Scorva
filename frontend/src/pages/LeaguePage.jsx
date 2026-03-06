import { useParams, Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import GameCard from "../components/cards/GameCard.jsx";
import leagueData from "../utilities/LeagueData";
import LoadingPage from "./LoadingPage.jsx";
import slugify from "../utilities/slugify.js";
import SeasonSelector from "../components/ui/SeasonSelector.jsx";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden:   { opacity: 0, y: 12 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export default function LeaguePage() {
  const { league } = useParams();
  const data = leagueData[league?.toLowerCase()];
  const [searchParams] = useSearchParams();

  const [games, setGames] = useState([]);
  const [standings, setStandings] = useState({ eastOrAFC: [], westOrNFC: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [displayData, setDisplayData] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(searchParams.get("season") || null);

  useEffect(() => {
    if (!data) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchData() {
      setLoading(true);
      setDisplayData(false);
      setError(null);

      try {
        const seasonParam = selectedSeason ? `?season=${selectedSeason}` : "";
        const gamesRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/${league}/games${seasonParam}`,
          { signal }
        );
        if (!gamesRes.ok) throw new Error(`HTTP ${gamesRes.status}`);
        const allGames = await gamesRes.json();
        setGames(allGames);

        const standingsRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/${league}/standings${seasonParam}`,
          { signal }
        );
        if (!standingsRes.ok) throw new Error(`HTTP ${standingsRes.status}`);
        const teams = await standingsRes.json();

        const isNFL = league === "nfl";
        const east = teams.filter((t) => t.conf?.toLowerCase() === (isNFL ? "afc" : "east"));
        const west = teams.filter((t) => t.conf?.toLowerCase() === (isNFL ? "nfc" : "west"));

        setStandings({ eastOrAFC: east, westOrNFC: west });
        await new Promise((r) => setTimeout(r, 50));
        setDisplayData(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch data:", err);
          setError("Failed to load data.");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    return () => controller.abort();
  }, [league, data, selectedSeason]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">League Not Found</h1>
        <p className="text-text-secondary text-sm mb-8 text-center max-w-md">
          The league you&apos;re looking for doesn&apos;t exist or isn&apos;t supported yet.
        </p>
        <Link
          to="/"
          className="bg-accent text-white font-semibold py-3 px-6 rounded-full text-sm transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(232,134,58,0.3)]"
        >
          Back to Homepage
        </Link>
      </div>
    );
  }

  if (error) return <div className="p-6 text-loss text-sm">{error}</div>;

  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-text-tertiary hover:text-text-primary transition-colors duration-200 mb-8 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>Home</span>
      </Link>

      {/* League header */}
      <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-5 mb-12">
        <div className="flex items-center gap-5">
          <img
            src={data.logo}
            alt={`${league} logo`}
            className="w-16 h-16 object-contain"
          />
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-text-primary uppercase">
            {league}
          </h1>
        </div>
        <SeasonSelector
          league={league}
          selectedSeason={selectedSeason}
          onSeasonChange={setSelectedSeason}
        />
      </div>

      {loading || !displayData ? (
        <LoadingPage />
      ) : error ? (
        <div className="p-6 text-loss text-sm">{error}</div>
      ) : (
        <>
          {/* Standings */}
          <div className="mb-20">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-10 text-center">
              Standings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* East / AFC */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-4 text-center">
                  {league === "nfl" ? "AFC" : "Eastern Conference"}
                </h3>
                <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                  {standings.eastOrAFC.map((team, index) => (
                    <Link
                      to={`/${league}/teams/${slugify(team.name)}${selectedSeason ? `?season=${selectedSeason}` : ""}`}
                      key={team.id}
                    >
                      <div className={`flex justify-between items-center px-5 py-3 hover:bg-surface-overlay transition-colors duration-150 cursor-pointer ${
                        index < standings.eastOrAFC.length - 1 ? "border-b border-white/[0.04]" : ""
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className="w-5 text-right text-text-tertiary text-xs tabular-nums">{index + 1}</span>
                          <img
                            src={team.logo_url}
                            alt={`${team.name} logo`}
                            className="w-6 h-6 object-contain"
                          />
                          <span className="text-sm font-medium text-text-primary">{team.name}</span>
                        </div>
                        <span className="text-sm text-text-secondary tabular-nums">
                          {team.wins}–{team.losses}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* West / NFC */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-widest text-text-tertiary mb-4 text-center">
                  {league === "nfl" ? "NFC" : "Western Conference"}
                </h3>
                <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                  {standings.westOrNFC.map((team, index) => (
                    <Link
                      to={`/${league}/teams/${slugify(team.name)}${selectedSeason ? `?season=${selectedSeason}` : ""}`}
                      key={team.id}
                    >
                      <div className={`flex justify-between items-center px-5 py-3 hover:bg-surface-overlay transition-colors duration-150 cursor-pointer ${
                        index < standings.westOrNFC.length - 1 ? "border-b border-white/[0.04]" : ""
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className="w-5 text-right text-text-tertiary text-xs tabular-nums">{index + 1}</span>
                          <img
                            src={team.logo_url}
                            alt={`${team.name} logo`}
                            className="w-6 h-6 object-contain"
                          />
                          <span className="text-sm font-medium text-text-primary">{team.name}</span>
                        </div>
                        <span className="text-sm text-text-secondary tabular-nums">
                          {team.wins}–{team.losses}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Games */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-10 text-center">
              Games
            </h2>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-5 justify-items-center items-start"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {games.map((game) => (
                <motion.div key={game.id} variants={itemVariants} className="w-full">
                  <GameCard game={game} />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
