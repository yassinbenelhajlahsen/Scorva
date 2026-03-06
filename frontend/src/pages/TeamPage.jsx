import { useParams, Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import GameCard from "../components/cards/GameCard";
import LoadingPage from "./LoadingPage.jsx";
import slugify from "../utilities/slugify.js";
import SeasonSelector from "../components/ui/SeasonSelector.jsx";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export default function TeamPage() {
  const { league: rawLeague, teamId } = useParams();
  const league = (rawLeague || "").toLowerCase();
  const [searchParams] = useSearchParams();

  const [team, setTeam] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(searchParams.get("season") || null);

  useEffect(() => {
    async function fetchTeamData() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/${league}/teams`
        );
        if (!res.ok) throw new Error("Failed to fetch teams.");
        const teamList = await res.json();
        const foundTeam = teamList.find(
          (t) =>
            slugify(t.name) === teamId || slugify(t.shortname || "") === teamId
        );

        if (!foundTeam) throw new Error("Team not found.");
        setTeam(foundTeam);
      } catch (err) {
        setError(err.message || "Failed to load data.");
        setLoading(false);
      }
    }
    fetchTeamData();
  }, [league, teamId]);

  useEffect(() => {
    if (!team) return;
    async function fetchGames() {
      try {
        const seasonParam = selectedSeason ? `&season=${selectedSeason}` : "";
        const gamesData = await (
          await fetch(
            `${import.meta.env.VITE_API_URL}/api/${league}/games?teamId=${team.id}${seasonParam}`
          )
        ).json();
        const sorted = gamesData
          .slice()
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        setGames(selectedSeason ? sorted : sorted.slice(0, 10));
      } catch (err) {
        setError(err.message || "Failed to load games.");
      } finally {
        setLoading(false);
      }
    }
    fetchGames();
  }, [league, team, selectedSeason]);

  if (loading) return <LoadingPage />;
  if (error || !team) {
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
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary text-center md:text-left">
            {team.name}
          </h1>
          <img
            src={team.logo_url || "/images/placeholder.png"}
            alt={team.name}
            className="w-44 h-44 object-contain"
          />
        </div>

        {/* Stats card */}
        <div className="flex-1">
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="grid grid-cols-2 gap-x-10 gap-y-4">
              <span className="text-sm text-text-tertiary">Location</span>
              <span className="text-sm font-medium text-text-primary">{team.location}</span>
              <span className="text-sm text-text-tertiary">Record</span>
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                {selectedSeason
                  ? `${games.filter((g) => g.winnerid === team.id).length}-${games.filter((g) => g.winnerid !== null && g.winnerid !== team.id).length}`
                  : team.record}
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
          {selectedSeason ? `${selectedSeason} Games` : "Last 10 Games"}
        </h2>
        {games.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-5 justify-items-center items-start"
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
        ) : (
          <p className="text-center text-text-tertiary text-sm mt-8">
            No recent games to show.
          </p>
        )}
      </div>
    </div>
  );
}
