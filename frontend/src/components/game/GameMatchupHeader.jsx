import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { m, AnimatePresence } from "framer-motion";
import { scoreUpdateVariants } from "../../utils/motion.js";
import teamUrl from "../../utils/teamUrl.js";
import { getPeriodLabel } from "../../utils/formatDate.js";
import { queryKeys, queryFns } from "../../lib/query.js";


function GameRatingBadge({ rating }) {
  if (!rating || rating.grade == null) return null;
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-overlay border border-white/[0.1]"
      aria-label={`Game rating ${rating.grade.toFixed(1)} out of 10${rating.tierLabel ? `, ${rating.tierLabel}` : ""}`}
    >
      <span className="text-xs font-bold text-accent" aria-hidden="true">★</span>
      <span className={`text-sm font-bold tabular-nums ${rating.grade < 0 ? "text-loss" : "text-text-primary"}`}>
        {rating.grade.toFixed(1)}
      </span>
    </div>
  );
}

export default function GameMatchupHeader({
  homeTeam,
  awayTeam,
  game,
  league,
  isFinal,
  inProgress,
  homeWon,
  awayWon,
  playoffLogo,
  scoreColor,
  gameRating,
}) {
  const queryClient = useQueryClient();
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-center justify-center gap-8 sm:gap-16 mb-10">
      {/* Home Team */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:justify-self-end">
        {homeTeam.info.logoUrl ? (
          <img
            src={homeTeam.info.logoUrl}
            alt={`${homeTeam.info.name} logo`}
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain"
            onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
          />
        ) : (
          <div className="w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0" />
        )}
        <div className="text-center sm:text-left">
          {homeTeam.info.name === "TBD" ? (
            <span className="text-2xl sm:text-4xl font-bold tracking-tight text-text-tertiary">
              TBD
            </span>
          ) : (
          <Link
            to={teamUrl(league, homeTeam.info)}
            className="text-2xl sm:text-4xl font-bold tracking-tight text-text-primary hover:text-accent transition-colors duration-200"
            onMouseEnter={() => {
              if (window.matchMedia("(hover: hover)").matches) {
                queryClient.prefetchQuery({ queryKey: queryKeys.team(league, teamUrl(league, homeTeam.info).split("/").pop()), queryFn: queryFns.team(league, teamUrl(league, homeTeam.info).split("/").pop()), staleTime: 10_000 });
              }
            }}
          >
            {homeTeam.info.shortName}
          </Link>
          )}
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
        {gameRating?.grade != null && <GameRatingBadge rating={gameRating} />}
        {playoffLogo && (
          <div className="flex flex-col items-center gap-1.5 mb-0.5">
            <div className="h-24 w-48 flex items-center justify-center">
              <img
                src={playoffLogo}
                alt={game.gameLabel}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            {game.gameLabel && (
              <span className="text-sm font-medium text-text-secondary text-center">
                {game.gameLabel}
              </span>
            )}
            {game.seriesScore && (() => {
              const { homeWins: h, awayWins: a } = game.seriesScore;
              if (h + a === 0) return null;
              const label =
                h === 4
                  ? `${homeTeam.info.shortName} win series ${h}-${a}`
                  : a === 4
                    ? `${awayTeam.info.shortName} win series ${a}-${h}`
                    : h === a
                      ? `Tied ${h}-${a}`
                      : h > a
                        ? `${homeTeam.info.shortName} lead ${h}-${a}`
                        : `${awayTeam.info.shortName} lead ${a}-${h}`;
              return (
                <span className="text-xs text-text-tertiary text-center block mt-0.5">
                  {label}
                </span>
              );
            })()}
          </div>
        )}
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
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:justify-self-start">
        <div className="text-center sm:text-right order-2 sm:order-1">
          {awayTeam.info.name === "TBD" ? (
            <span className="text-2xl sm:text-4xl font-bold tracking-tight text-text-tertiary">
              TBD
            </span>
          ) : (
          <Link
            to={teamUrl(league, awayTeam.info)}
            className="text-2xl sm:text-4xl font-bold tracking-tight text-text-primary hover:text-accent transition-colors duration-200"
            onMouseEnter={() => {
              if (window.matchMedia("(hover: hover)").matches) {
                queryClient.prefetchQuery({ queryKey: queryKeys.team(league, teamUrl(league, awayTeam.info).split("/").pop()), queryFn: queryFns.team(league, teamUrl(league, awayTeam.info).split("/").pop()), staleTime: 10_000 });
              }
            }}
          >
            {awayTeam.info.shortName}
          </Link>
          )}
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
        {awayTeam.info.logoUrl ? (
          <img
            src={awayTeam.info.logoUrl}
            alt={`${awayTeam.info.name} logo`}
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain order-1 sm:order-2"
            onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
          />
        ) : (
          <div className="w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0 order-1 sm:order-2" />
        )}
      </div>
    </div>
  );
}
