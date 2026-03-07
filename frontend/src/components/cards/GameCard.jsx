import { Link } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDateShort, getPeriodLabel } from "../../utilities/formatDate";
import { scoreUpdateVariants } from "../../utilities/motion.js";

export default function GameCard({ game }) {
  const [isHovered, setIsHovered] = useState(false);
  const isFinal = game.status.includes("Final");
  const inProgress =
    game.status.includes("In Progress") ||
    game.status.includes("End of Period");
  const homeWon = isFinal && game.hometeamid === game.winnerid;
  const awayWon = isFinal && game.awayteamid === game.winnerid;
  const league = game.league;
  if (!league) return null;

  const nhl = league === "nhl";
  const isPlayoff = !!game.game_label && game.game_label.toLowerCase() !== "Preseason";
  const label = game.game_label?.toLowerCase() || "";
  const isChampionship = label.includes("nba finals") || label.includes("stanley cup") || label.includes("super bowl");
  const isSuperBowl = label.includes("super bowl");
  const isStanley = label.includes("Stanley");

  const playoffLogo = isPlayoff
    ? `/${league.toUpperCase()}/${league.toUpperCase()}${isChampionship ? "Final" : "Playoff"}.png`
    : null;

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative bg-surface-elevated border border-white/[0.08] p-5 text-center rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-overlay hover:border-white/[0.14] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.45)] cursor-pointer flex flex-col overflow-hidden">

        {/* Teams & Scores */}
        <div className="flex items-center justify-between gap-4 min-h-[110px]">
          {/* Home */}
          <div className="flex flex-col items-center flex-1 gap-1.5">
            <img
              src={game.home_logo || "/backupTeamLogo.webp"}
              alt={`${game.homeTeam} logo`}
              className="w-12 h-12 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/backupTeamLogo.webp";
              }}
            />
            <div className="text-sm font-semibold text-text-primary line-clamp-1">
              {game.home_shortname}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={game.homescore}
                variants={scoreUpdateVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={`text-lg font-bold min-h-[28px] ${scoreColor(homeWon, awayWon && isFinal)}`}
              >
                {game.homescore}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center flex-shrink-0 gap-0.5">
            <span className="text-xs text-text-tertiary">
              {formatDateShort(game.date)}
            </span>
            <div className="text-xs font-medium text-text-tertiary">vs</div>
            {inProgress && (
              <>
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="text-[10px] font-semibold uppercase tracking-widest text-live bg-live/10 px-2 py-0.5 rounded-full mt-1"
                >
                  Live
                </motion.span>
                {game.clock && (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`${game.current_period}-${game.clock}`}
                      variants={scoreUpdateVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="text-[10px] text-live/70 font-medium mt-0.5"
                    >
                      {parseFloat(game.clock) === 0
                        ? `End of ${getPeriodLabel(game.current_period, game.league)}`
                        : `${getPeriodLabel(game.current_period, game.league)} ${game.clock}`}
                    </motion.span>
                  </AnimatePresence>
                )}
              </>
            )}
            {!inProgress && (
              <p className="text-xs text-text-tertiary text-center px-1 max-w-[80px]">
                {game.status}
              </p>
            )}
            {isPlayoff && (
              <div className={`mt-1 flex items-center justify-center h-20 w-20`}>
                <img src={playoffLogo} alt={game.game_label} className={`max-h-full max-w-full object-contain ${(isSuperBowl || isStanley) ? "p-1.5" : ""}`} />
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center flex-1 gap-1.5">
            <img
              src={game.away_logo || "/backupTeamLogo.webp"}
              alt={`${game.awayteam} logo`}
              className="w-12 h-12 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/backupTeamLogo.webp";
              }}
            />
            <div className="text-sm font-semibold text-text-primary line-clamp-1">
              {game.away_shortname}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={game.awayscore}
                variants={scoreUpdateVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={`text-lg font-bold min-h-[28px] ${scoreColor(awayWon, homeWon && isFinal)}`}
              >
                {game.awayscore}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Quarter breakdown — NHL */}
        {nhl && (
          <ul
            className={`mt-3 text-sm text-text-secondary font-mono overflow-hidden transition-[max-height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] space-y-1 border-t border-white/[0.06] pt-3 ${
              isHovered ? "max-h-[300px]" : "max-h-0 pt-0 border-t-0"
            }`}
          >
            <li className="text-text-primary text-xs font-semibold text-center mb-1">
              {game.status}
            </li>
            <li className="flex justify-between text-[11px] text-text-tertiary px-2">
              <span className="w-12" />
              <span className="w-8 text-center">1</span>
              <span className="w-8 text-center">2</span>
              <span className="w-8 text-center">3</span>
              {["ot1", "ot2", "ot3", "ot4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">{key.toUpperCase()}</span>
                ) : null
              )}
              <span className="w-8 text-center font-semibold">T</span>
            </li>
            <li className="flex justify-between px-2 text-xs">
              <span className="w-12 font-semibold text-left text-text-primary">{game.away_shortname}</span>
              <span className="w-8 text-center">{game.firstqtr?.split("-")[1]}</span>
              <span className="w-8 text-center">{game.secondqtr?.split("-")[1]}</span>
              <span className="w-8 text-center">{game.thirdqtr?.split("-")[1]}</span>
              {["ot1", "ot2", "ot3", "ot4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">{game[key].split("-")[1]}</span>
                ) : null
              )}
              <span className={`w-8 text-center font-semibold ${awayWon ? "text-win" : isFinal ? "text-loss" : ""}`}>
                {isFinal && game.awayscore}
              </span>
            </li>
            <li className="flex justify-between px-2 text-xs">
              <span className="w-12 font-semibold text-left text-text-primary">{game.home_shortname}</span>
              <span className="w-8 text-center">{game.firstqtr?.split("-")[0]}</span>
              <span className="w-8 text-center">{game.secondqtr?.split("-")[0]}</span>
              <span className="w-8 text-center">{game.thirdqtr?.split("-")[0]}</span>
              {["ot1", "ot2", "ot3", "ot4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">{game[key].split("-")[0]}</span>
                ) : null
              )}
              <span className={`w-8 text-center font-semibold ${homeWon ? "text-win" : isFinal ? "text-loss" : ""}`}>
                {isFinal && game.homescore}
              </span>
            </li>
          </ul>
        )}

        {/* Quarter breakdown — NBA / NFL */}
        {(isFinal || inProgress) && !nhl && (
          <ul
            className={`mt-3 text-sm text-text-secondary font-mono overflow-hidden transition-[max-height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] space-y-1 border-t border-white/[0.06] pt-3 ${
              isHovered ? "max-h-[300px]" : "max-h-0 pt-0 border-t-0"
            }`}
          >
            <li className="text-text-primary text-xs font-semibold text-center mb-1">
              {game.status}
            </li>
            <li className="flex justify-between text-[11px] text-text-tertiary px-2">
              <span className="w-12" />
              <span className="w-8 text-center">1</span>
              <span className="w-8 text-center">2</span>
              <span className="w-8 text-center">3</span>
              <span className="w-8 text-center">4</span>
              {["ot1", "ot2", "ot3", "ot4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">{key.toUpperCase()}</span>
                ) : null
              )}
              <span className="w-8 text-center font-semibold">T</span>
            </li>
            <li className="flex justify-between px-2 text-xs">
              <span className="w-12 font-semibold text-left text-text-primary">{game.away_shortname}</span>
              <span className="w-8 text-center">{game.firstqtr?.split("-")[1]}</span>
              <span className="w-8 text-center">{game.secondqtr?.split("-")[1]}</span>
              <span className="w-8 text-center">{game.thirdqtr?.split("-")[1]}</span>
              <span className="w-8 text-center">{game.fourthqtr?.split("-")[1]}</span>
              {["ot1", "ot2", "ot3", "ot4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">{game[key].split("-")[1]}</span>
                ) : null
              )}
              <span className={`w-8 text-center font-semibold ${awayWon ? "text-win" : isFinal ? "text-loss" : ""}`}>
                {isFinal && game.awayscore}
              </span>
            </li>
            <li className="flex justify-between px-2 text-xs">
              <span className="w-12 font-semibold text-left text-text-primary">{game.home_shortname}</span>
              <span className="w-8 text-center">{game.firstqtr?.split("-")[0]}</span>
              <span className="w-8 text-center">{game.secondqtr?.split("-")[0]}</span>
              <span className="w-8 text-center">{game.thirdqtr?.split("-")[0]}</span>
              <span className="w-8 text-center">{game.fourthqtr?.split("-")[0]}</span>
              {["ot1", "ot2", "ot3", "ot4"].map((key) =>
                game[key] ? (
                  <span key={key} className="w-10 text-center">{game[key].split("-")[0]}</span>
                ) : null
              )}
              <span className={`w-8 text-center font-semibold ${homeWon ? "text-win" : isFinal ? "text-loss" : ""}`}>
                {isFinal && game.homescore}
              </span>
            </li>
          </ul>
        )}
      </div>
    </Link>
  );
}
