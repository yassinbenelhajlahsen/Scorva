import { Link } from "react-router-dom";
import { useState, useEffect, useRef, memo } from "react";
import { m, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateShort, getPeriodLabel } from "../../utils/formatDate";
import { scoreUpdateVariants } from "../../utils/motion.js";
import { queryKeys, queryFns } from "../../lib/query.js";

function useScoreAnimKey(score) {
  const prev = useRef(undefined);
  const key = useRef(0);
  if (prev.current !== undefined && prev.current !== score) {
    key.current++;
  }
  prev.current = score;
  return key.current;
}

function GameCard({ game }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOtherExpand = (e) => {
      if (e.detail.id !== game.id) setIsExpanded(false);
    };
    window.addEventListener("gamecard:expand", handleOtherExpand);
    return () => window.removeEventListener("gamecard:expand", handleOtherExpand);
  }, [game.id]);
  const isFinal = game.status.includes("Final");
  const inProgress =
    game.status.includes("In Progress") || 
    game.status.includes("Halftime") ||
    game.status.includes("End of Period");
  const homeWon = isFinal && game.hometeamid === game.winnerid;
  const awayWon = isFinal && game.awayteamid === game.winnerid;
  const homeAnimKey = useScoreAnimKey(game.homescore);
  const awayAnimKey = useScoreAnimKey(game.awayscore);
  const clockAnimKey = useScoreAnimKey(`${game.current_period}-${game.clock}`);

  const league = game.league;
  if (!league) return null;

  // ESPN uses placeholder teams like "Suns/Trail Blazers" for undecided
  // play-in slots — no real NBA team has "/" in its name.
  const homePlaceholder = game.home_shortname?.includes("/");
  const awayPlaceholder = game.away_shortname?.includes("/");
  const homeName = homePlaceholder ? "TBD" : game.home_shortname;
  const awayName = awayPlaceholder ? "TBD" : game.away_shortname;
  const homeLogo = homePlaceholder ? null : game.home_logo;
  const awayLogo = awayPlaceholder ? null : game.away_logo;

  const nhl = league === "nhl";
  const gameType = game.type || 'regular';
  const isPlayoff = gameType === 'playoff' || gameType === 'final';

  const scoreColor = (isWinner, isLoser) => {
    if (!isFinal) return "text-text-primary";
    if (isWinner) return "text-win";
    if (isLoser) return "text-loss";
    return "text-text-tertiary";
  };

  return (
    <Link
      to={`/${league}/games/${game.id}`}
      className="block no-underline"
      onMouseEnter={() => {
        if (window.matchMedia("(hover: hover)").matches) {
          setIsExpanded(true);
          queryClient.prefetchQuery({
            queryKey: queryKeys.game(league, game.id),
            queryFn: queryFns.game(league, game.id),
            staleTime: 10_000,
          });
        }
      }}
      onMouseLeave={() => { if (window.matchMedia("(hover: hover)").matches) setIsExpanded(false); }}
    >
      <div className="relative bg-surface-elevated border border-white/[0.08] p-5 text-center rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.45)] cursor-pointer flex flex-col overflow-hidden">

        {/* Teams & Scores */}
        <div className="flex items-center justify-between gap-4 h-[120px]">
          {/* Home */}
          <div className="flex flex-col items-center flex-1 gap-1.5">
            {homeLogo && (
              <img
                loading="lazy"
                src={homeLogo}
                alt={`${game.home_team_name} logo`}
                className="w-12 h-12 object-contain"
                onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
              />
            )}
            <div className="text-sm font-semibold text-text-primary line-clamp-1">
              {homeName}
            </div>
            {(isFinal || inProgress) && (
              <AnimatePresence mode="wait">
                <m.div
                  key={homeAnimKey}
                  variants={scoreUpdateVariants}
                  initial={homeAnimKey === 0 ? false : "initial"}
                  animate="animate"
                  exit="exit"
                  className={`text-lg font-bold min-h-[28px] ${scoreColor(homeWon, awayWon && isFinal)}`}
                >
                  {game.homescore}
                </m.div>
              </AnimatePresence>
            )}
          </div>

          {/* Center */}
          <div className="flex flex-col items-center justify-center flex-shrink-0 w-[90px] gap-0.5 h-full overflow-hidden">
            {!isFinal && !inProgress && game.start_time ? (
              <>
                <span className="text-xs text-text-tertiary">{formatDateShort(game.date)}</span>
                <span className="text-xs text-text-tertiary">{game.start_time}</span>
              </>
            ) : (
              <span className="text-xs text-text-tertiary">{formatDateShort(game.date)}</span>
            )}
            {inProgress && (
              <>
                <m.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="text-[10px] font-semibold uppercase tracking-widest text-live bg-live/10 px-2 py-0.5 rounded-full mt-1"
                >
                  Live
                </m.span>
                {game.clock && (
                  <AnimatePresence mode="wait">
                    <m.span
                      key={clockAnimKey}
                      variants={scoreUpdateVariants}
                      initial={clockAnimKey === 0 ? false : "initial"}
                      animate="animate"
                      exit="exit"
                      className="text-[10px] text-live/70 font-medium mt-0.5"
                    >
                      {parseFloat(game.clock) === 0
                        ? `End of ${getPeriodLabel(game.current_period, game.league)}`
                        : `${getPeriodLabel(game.current_period, game.league)} ${game.clock}`}
                    </m.span>
                  </AnimatePresence>
                )}
              </>
            )}
            {!inProgress && (
              <p className="text-xs text-text-tertiary text-center px-1 max-w-[80px]">
                {game.status}
              </p>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center flex-1 gap-1.5">
            {awayLogo && (
              <img
                loading="lazy"
                src={awayLogo}
                alt={`${game.away_team_name} logo`}
                className="w-12 h-12 object-contain"
                onError={(e) => { e.target.onerror = null; e.target.style.display = "none"; }}
              />
            )}
            <div className="text-sm font-semibold text-text-primary line-clamp-1">
              {awayName}
            </div>
            {(isFinal || inProgress) && (
              <AnimatePresence mode="wait">
                <m.div
                  key={awayAnimKey}
                  variants={scoreUpdateVariants}
                  initial={awayAnimKey === 0 ? false : "initial"}
                  animate="animate"
                  exit="exit"
                  className={`text-lg font-bold min-h-[28px] ${scoreColor(awayWon, homeWon && isFinal)}`}
                >
                  {game.awayscore}
                </m.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Quarter/period breakdown */}
        {(isFinal || inProgress) && (() => {
          const quarters = nhl
            ? [game.firstqtr, game.secondqtr, game.thirdqtr]
            : [game.firstqtr, game.secondqtr, game.thirdqtr, game.fourthqtr];
          const otKeys = ["ot1", "ot2", "ot3", "ot4"].filter((k) => game[k]);
          return (
            <div className={`overflow-hidden transition-[max-height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isExpanded ? "max-h-[300px]" : "max-h-0"}`}>
              <div className="mt-3 font-mono text-sm border-t border-white/[0.06] pt-3">
                <div className="flex items-center gap-x-3 text-[10px] uppercase tracking-widest text-text-tertiary pb-2 border-b border-white/[0.06]">
                  <span className="flex-1 min-w-0 text-left">Team</span>
                  {quarters.map((_, i) => (
                    <span key={i} className="w-7 text-center shrink-0">{i + 1}</span>
                  ))}
                  {otKeys.map((key, i) => (
                    <span key={key} className="w-8 text-center shrink-0">
                      {i === 0 ? "OT" : `OT${i + 1}`}
                    </span>
                  ))}
                  <span className="w-7 text-center shrink-0 font-semibold text-text-secondary">T</span>
                </div>
                <div className="flex items-center gap-x-3 py-2">
                  <span className="flex-1 min-w-0 text-left font-semibold text-text-primary truncate text-xs">{homeName}</span>
                  {quarters.map((q, i) => (
                    <span key={i} className="w-7 text-center shrink-0 text-text-secondary text-xs">{q?.split("-")[0] ?? "–"}</span>
                  ))}
                  {otKeys.map((key) => (
                    <span key={key} className="w-8 text-center shrink-0 text-text-secondary text-xs">{game[key].split("-")[0]}</span>
                  ))}
                  <span className={`w-7 text-center shrink-0 font-bold tabular-nums text-xs ${scoreColor(homeWon, awayWon && isFinal)}`}>
                    {game.homescore}
                  </span>
                </div>
                <div className="border-t border-white/[0.04]" />
                <div className="flex items-center gap-x-3 py-2">
                  <span className="flex-1 min-w-0 text-left font-semibold text-text-primary truncate text-xs">{awayName}</span>
                  {quarters.map((q, i) => (
                    <span key={i} className="w-7 text-center shrink-0 text-text-secondary text-xs">{q?.split("-")[1] ?? "–"}</span>
                  ))}
                  {otKeys.map((key) => (
                    <span key={key} className="w-8 text-center shrink-0 text-text-secondary text-xs">{game[key].split("-")[1]}</span>
                  ))}
                  <span className={`w-7 text-center shrink-0 font-bold tabular-nums text-xs ${scoreColor(awayWon, homeWon && isFinal)}`}>
                    {game.awayscore}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Playoff round label + series score */}
        {isPlayoff && game.game_label && (
          <p className="mt-2 pt-2 border-t border-white/[0.06] text-xs font-medium text-text-tertiary text-center tracking-wide">
            {game.game_label}
          </p>
        )}
        {isPlayoff && game.game_label && (() => {
          const h = Number(game.home_series_wins ?? 0);
          const a = Number(game.away_series_wins ?? 0);
          if (h + a === 0) return null;
          const label =
            h === 4
              ? `${homeName} win series ${h}-${a}`
              : a === 4
                ? `${awayName} win series ${a}-${h}`
                : h === a
                  ? `Tied ${h}-${a}`
                  : h > a
                    ? `${homeName} lead ${h}-${a}`
                    : `${awayName} lead ${a}-${h}`;
          return (
            <p className="text-[10px] text-text-tertiary text-center mt-0.5">
              {label}
            </p>
          );
        })()}

        {/* Mobile-only expand button — shown only on touch devices when there's a breakdown to reveal */}
        {(isFinal || inProgress) && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(v => {
                const next = !v;
                if (next) window.dispatchEvent(new CustomEvent("gamecard:expand", { detail: { id: game.id } }));
                return next;
              });
            }}
            aria-label={isExpanded ? "Hide quarter breakdown" : "Show quarter breakdown"}
            className="[@media(hover:hover)]:hidden [@media(hover:hover)]:mt-0 mt-3 mx-auto flex items-center gap-1 text-[11px] text-text-tertiary transition-colors duration-150 active:text-text-secondary"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
            {isExpanded ? "Hide" : "Breakdown"}
          </button>
        )}
      </div>
    </Link>
  );
}

export default memo(GameCard, (prev, next) => {
  const p = prev.game, n = next.game;
  return p.id === n.id && p.homescore === n.homescore && p.awayscore === n.awayscore &&
    p.status === n.status && p.clock === n.clock && p.current_period === n.current_period &&
    p.winnerid === n.winnerid;
});
