import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import LoadingPage from "./LoadingPage.jsx";

import PlayerAvgCard from "../components/cards/PlayerAvgCard.jsx";
import slugify from "../utilities/slugify.js";
import formatDate from "../utilities/formatDate.js";
import StatCard from "../components/cards/StatCard.jsx";

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

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export default function PlayerPage() {
  const { league, playerId: slug } = useParams();
  const [playerData, setPlayerData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlayerData() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/${league}/players`
        );
        const players = await res.json();

        const match = players.find(
          (p) => slugify(p.name, { lower: true }) === slug
        );
        if (!match) { setPlayerData(null); return; }

        const fullRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/${league}/players/${match.id}`
        );
        const fullData = await fullRes.json();
        setPlayerData(fullData.player);
      } catch (err) {
        console.error("Error fetching player:", err);
        setPlayerData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayerData();
  }, [league, slug]);

  if (loading) return <LoadingPage />;

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

  const { id, name, position, jerseyNumber, height, weight, imageUrl, seasonAverages, team, dob, draftInfo, games } = playerData;

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
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary text-center md:text-left">
            {name}
          </h1>
          <img
            src={imageUrl || "/images/placeholder.png"}
            alt={name}
            className="w-56 h-56 object-cover rounded-3xl ring-1 ring-white/[0.08]"
          />
        </div>

        {/* Info card */}
        <div className="flex-1 flex flex-col gap-6">
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
                to={`/${league}/teams/${slugify(team.name)}`}
                className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors duration-200"
              >
                {team.name}
              </Link>
            </div>
          </div>

          {games && (
            <PlayerAvgCard league={league} averages={seasonAverages} season={games.season} />
          )}
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
