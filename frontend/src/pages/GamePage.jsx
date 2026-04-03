import { Link, useParams, useLocation } from "react-router-dom";
import { Fragment, useEffect, useMemo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { scoreUpdateVariants } from "../utils/motion.js";

import BoxScore from "../components/ui/BoxScore.jsx";
import AISummary from "../components/ui/AISummary.jsx";
import slugify from "../utils/slugify.js";
import computeTopPlayers from "../utils/topPlayers.js";
import TopPerformerCard from "../components/cards/TopPerformerCard.jsx";
import formatDate, { formatDateWithTime, getPeriodLabel } from "../utils/formatDate.js";
import { useGame } from "../hooks/data/useGame.js";
import GamePageSkeleton from "../components/skeletons/GamePageSkeleton.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";

export default function GamePage() {
  const location = useLocation();
  const { league, gameId } = useParams();
  const { gameData, loading, error, retry } = useGame(league, gameId);

  useEffect(() => {
    if (!gameData || !location.hash) return;

    const id = location.hash.slice(1);
    requestAnimationFrame(() => {
      const row = document.getElementById(id);
      if (!row) return;

      const link = row.querySelector("a");
      row.classList.add("transition-colors", "duration-300", "ease-in-out");
      link?.classList.add("transition-colors", "duration-300", "ease-in-out");
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      void row.offsetWidth;

      row.classList.add("bg-accent/15");
      link?.classList.add("!text-white");

      setTimeout(() => {
        row.classList.remove("bg-accent/15");
        link?.classList.remove("!text-white");
        setTimeout(() => {
          row.classList.remove("transition-colors", "duration-300", "ease-in-out");
          link?.classList.remove("transition-colors", "duration-300", "ease-in-out");
        }, 300);
      }, 2000);
    });
  }, [gameData, location.hash]);

  const gameObj = gameData?.json_build_object;
  const homeTeamData = gameObj?.homeTeam;
  const awayTeamData = gameObj?.awayTeam;

  const allPlayerStats = useMemo(
    () => [...(homeTeamData?.players || []), ...(awayTeamData?.players || [])],
    [homeTeamData?.players, awayTeamData?.players]
  );

  const topPlayers = useMemo(
    () => gameObj ? computeTopPlayers(gameObj.game, allPlayerStats, league) : {},
    [gameObj, allPlayerStats, league]
  );

  if (loading) {
    const staleStatus = gameData?.json_build_object?.game?.status ?? "";
    const staleScheduled = staleStatus
      ? !staleStatus.includes("Final") &&
        !staleStatus.includes("In Progress") &&
        !staleStatus.includes("End of Period") &&
        !staleStatus.includes("Halftime")
      : false;
    return <GamePageSkeleton scheduled={staleScheduled} />;
  }
  if (error && !gameData) return <ErrorState message="Could not load game data." onRetry={retry} />;
  if (!gameData?.json_build_object) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">Game Not Found</h1>
        <p className="text-text-secondary text-sm mb-8 text-center max-w-md">
          The game you&apos;re looking for doesn&apos;t exist or hasn&apos;t been added yet.
        </p>
        <Link
          to={`/${league}`}
          className="bg-accent text-white font-semibold py-3 px-6 rounded-full text-sm transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(232,134,58,0.3)]"
        >
          Back to {league?.toUpperCase()} Games
        </Link>
      </div>
    );
  }

  const { game, homeTeam, awayTeam } = gameData.json_build_object;
  const { topPerformer, topScorer, impactPlayer } = topPlayers;
  const isFinal = game.status.includes("Final");
  const inProgress =
    game.status.includes("In Progress") ||
    game.status.includes("Halftime") ||
    game.status.includes("End of Period");
  const homeWon = isFinal && game.winnerId === homeTeam.info.id;
  const awayWon = isFinal && game.winnerId === awayTeam.info.id;
  const nhl = league === "nhl";
  const gameType = game.gameType || 'regular';
  const isPlayoffGame = gameType === 'playoff' || gameType === 'final';
  const isChampionship = gameType === 'final';
  const playoffLogo = isPlayoffGame
    ? `/${league.toUpperCase()}/${league.toUpperCase()}${isChampionship ? "Final" : "Playoff"}.webp`
    : null;
  const quarterKeys = nhl ? ["q1", "q2", "q3"] : ["q1", "q2", "q3", "q4"];

  const scoreColor = (won, lost) => {
    if (!isFinal && !inProgress) return "text-text-primary";
    if (won) return "text-win";
    if (lost) return "text-loss";
    return "text-text-tertiary";
  };

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
        <span>{league?.toUpperCase()} Games</span>
      </Link>

      {/* Matchup header */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 mb-10">
        {/* Home Team */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <img
            src={homeTeam.info.logoUrl || "/backupTeamLogo.webp"}
            alt={`${homeTeam.info.name} logo`}
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
            onError={(e) => { e.target.onerror = null; e.target.src = "/backupTeamLogo.webp"; }}
          />
          <div className="text-center sm:text-left">
            <Link
              to={`/${league}/teams/${slugify(homeTeam.info.name)}`}
              className="text-2xl sm:text-4xl font-bold tracking-tight text-text-primary hover:text-accent transition-colors duration-200"
            >
              {homeTeam.info.shortName}
            </Link>
            {(isFinal || inProgress) && (
              <AnimatePresence mode="wait">
                <m.div
                  key={game.score.home}
                  variants={scoreUpdateVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={`text-3xl sm:text-5xl font-bold tabular-nums mt-1 ${scoreColor(homeWon, awayWon && isFinal)}`}
                >
                  {game.score.home}
                </m.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* VS divider */}
        <div className="flex flex-col items-center gap-1.5">
          {playoffLogo && (
            <div className="flex flex-col items-center gap-1.5 mb-0.5">
              <div className="h-24 w-48 flex items-center justify-center">
                <img src={playoffLogo} alt={game.gameLabel} className="max-h-full max-w-full object-contain" />
              </div>
              {game.gameLabel && (
                <span className="text-s font-medium text-text-secondary text-center">
                  {game.gameLabel}
                </span>
              )}
            </div>
          )}
          <span className="text-sm font-medium text-text-tertiary">vs</span>
          {inProgress && (
            <m.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="text-[10px] font-semibold uppercase tracking-widest text-live bg-live/10 px-2 py-0.5 rounded-full"
            >
              Live
            </m.span>
          )}
          {inProgress && game.clock && (
            <AnimatePresence mode="wait">
              <m.span
                key={`${game.currentPeriod}-${game.clock}`}
                variants={scoreUpdateVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="text-loss text-xs"
              >
                {parseFloat(game.clock) === 0
                  ? `End of ${getPeriodLabel(game.currentPeriod, league)}`
                  : `${getPeriodLabel(game.currentPeriod, league)} · ${game.clock}`}
              </m.span>
            </AnimatePresence>
          )}
          {!inProgress && !isFinal && (
            <span className="text-xs text-text-tertiary">{game.status}</span>
          )}
        </div>

        {/* Away Team */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="text-center sm:text-right order-2 sm:order-1">
            <Link
              to={`/${league}/teams/${slugify(awayTeam.info.name)}`}
              className="text-2xl sm:text-4xl font-bold tracking-tight text-text-primary hover:text-accent transition-colors duration-200"
            >
              {awayTeam.info.shortName}
            </Link>
            {(isFinal || inProgress) && (
              <AnimatePresence mode="wait">
                <m.div
                  key={game.score.away}
                  variants={scoreUpdateVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={`text-3xl sm:text-5xl font-bold tabular-nums mt-1 ${scoreColor(awayWon, homeWon && isFinal)}`}
                >
                  {game.score.away}
                </m.div>
              </AnimatePresence>
            )}
          </div>
          <img
            src={awayTeam.info.logoUrl || "/backupTeamLogo.webp"}
            alt={`${awayTeam.info.name} logo`}
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain order-1 sm:order-2"
            onError={(e) => { e.target.onerror = null; e.target.src = "/backupTeamLogo.webp"; }}
          />
        </div>
      </div>

      {/* Game info + Quarter scores */}
      <div className={`mb-6 ${isFinal || inProgress ? "grid grid-cols-1 lg:grid-cols-[32.5%_1fr] gap-4" : ""}`}>
        {/* Game info */}
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col gap-3">
          {[
            {
              label: "Date",
              value: game.startTime && !isFinal && !inProgress
                ? formatDateWithTime(game.date, game.startTime)
                : formatDate(game.date),
            },
            { label: "Status",   value: game.status },
            { label: "Location", value: game.venue },
            ...(game.broadcast ? [{ label: "Broadcast", value: game.broadcast }] : []),
          ].map(({ label, value }, i) => (
            <Fragment key={label}>
              {i > 0 && <div className="border-t border-white/[0.06]" />}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs uppercase tracking-wider text-text-tertiary shrink-0">{label}</span>
                <span className="text-sm font-medium text-text-primary text-right">{value}</span>
              </div>
            </Fragment>
          ))}
        </div>

        {/* Quarter-by-quarter */}
        {(isFinal || inProgress) && (
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col">
            <div className="font-mono text-sm w-full flex flex-col flex-1">
              {/* Header row */}
              <div className="flex items-center gap-x-2 text-[10px] uppercase tracking-widest text-text-tertiary pb-2 border-b border-white/[0.06]">
                <span className="flex-1 min-w-0">Team</span>
                {quarterKeys.map((_, i) => (
                  <span key={i} className="w-9 text-center shrink-0">{i + 1}</span>
                ))}
                {game.score.quarters.ot.map(
                  (val, i) => val && (
                    <span key={`OT${i + 1}`} className="w-9 text-center shrink-0">
                      {i === 0 ? "OT" : `OT${i + 1}`}
                    </span>
                  )
                )}
                <span className="w-9 text-center shrink-0 font-semibold text-text-secondary">T</span>
              </div>

              {/* Home row */}
              <div className="flex items-center gap-x-2 flex-1">
                <span className="flex-1 min-w-0 font-semibold text-text-primary truncate">
                  {homeTeam.info.shortName}
                </span>
                {quarterKeys.map((q) => (
                  <span key={q} className="w-9 text-center shrink-0 text-text-secondary">
                    {game.score.quarters[q]?.split("-")[0] ?? "–"}
                  </span>
                ))}
                {game.score.quarters.ot.map(
                  (val, i) => val && (
                    <span key={`home-OT${i + 1}`} className="w-9 text-center shrink-0 text-text-secondary">
                      {val.split("-")[0]}
                    </span>
                  )
                )}
                <span className={`w-9 text-center shrink-0 font-bold tabular-nums ${scoreColor(homeWon, awayWon && isFinal)}`}>
                  {(isFinal || inProgress) && game.score.home}
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-white/[0.04]" />

              {/* Away row */}
              <div className="flex items-center gap-x-2 flex-1">
                <span className="flex-1 min-w-0 font-semibold text-text-primary truncate">
                  {awayTeam.info.shortName}
                </span>
                {quarterKeys.map((q) => (
                  <span key={q} className="w-9 text-center shrink-0 text-text-secondary">
                    {game.score.quarters[q]?.split("-")[1] ?? "–"}
                  </span>
                ))}
                {game.score.quarters.ot.map(
                  (val, i) => val && (
                    <span key={`away-OT${i + 1}`} className="w-9 text-center shrink-0 text-text-secondary">
                      {val.split("-")[1]}
                    </span>
                  )
                )}
                <span className={`w-9 text-center shrink-0 font-bold tabular-nums ${scoreColor(awayWon, homeWon && isFinal)}`}>
                  {(isFinal || inProgress) && game.score.away}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top performers */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <TopPerformerCard title="Top Performer" player={topPerformer} league={league} />
        <TopPerformerCard title="Top Scorer"    player={topScorer}    league={league} />
        <TopPerformerCard title="Impact Player" player={impactPlayer} league={league} />
      </div>

      {/* AI Summary */}
      {isFinal && <AISummary gameId={gameId} />}

      {/* Box Score */}
      {isFinal || inProgress ? (
        <BoxScore homeTeam={homeTeam} awayTeam={awayTeam} league={league} season={game.season} />
      ) : (
        <div className="text-center text-text-tertiary text-sm my-8">
          No box score available — check back when the game starts.
        </div>
      )}
    </div>
  );
}
