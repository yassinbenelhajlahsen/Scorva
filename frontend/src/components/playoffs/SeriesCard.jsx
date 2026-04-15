import { useState } from "react";
import { Link } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFns } from "../../lib/query.js";
import { formatDateNumeric } from "../../utils/formatDate.js";

function TeamRow({ team, wins, isWinner, isLoser }) {
  if (!team) {
    return (
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 text-right text-text-tertiary text-[11px] tabular-nums">–</span>
          <div className="w-5 h-5 rounded-full bg-white/[0.04]" />
          <span className="text-xs text-text-tertiary truncate">TBD</span>
        </div>
        <span className="text-xs text-text-tertiary tabular-nums">–</span>
      </div>
    );
  }

  const borderStyle = team.primary_color
    ? { boxShadow: `inset 3px 0 0 ${team.primary_color}` }
    : undefined;

  return (
    <div
      className="flex items-center justify-between px-3 py-2 gap-2"
      style={borderStyle}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-5 text-right text-text-tertiary text-[11px] tabular-nums">
          {team.seed ?? "–"}
        </span>
        {team.logo_url ? (
          <img
            loading="lazy"
            src={team.logo_url}
            alt={`${team.name} logo`}
            className="w-5 h-5 object-contain flex-shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-white/[0.04]" />
        )}
        <div className="min-w-0">
          <div
            className={`text-xs font-medium truncate ${
              isLoser ? "text-text-tertiary" : "text-text-primary"
            }`}
          >
            {team.shortname || team.name}
          </div>
          {team.record && (
            <div className="text-[10px] text-text-tertiary tabular-nums leading-tight">
              {team.record}
            </div>
          )}
        </div>
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${
          isWinner ? "text-win" : isLoser ? "text-text-tertiary" : "text-text-secondary"
        }`}
      >
        {wins}
      </span>
    </div>
  );
}

export default function SeriesCard({ series, league }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { teamA, teamB, games = [], winnerId, isComplete } = series;
  const winsA = teamA ? series.wins?.[teamA.id] ?? 0 : 0;
  const winsB = teamB ? series.wins?.[teamB.id] ?? 0 : 0;

  const aIsWinner = isComplete && winnerId === teamA?.id;
  const bIsWinner = isComplete && winnerId === teamB?.id;
  const hasLoser = isComplete && winnerId != null;
  const aIsLoser = hasLoser && !aIsWinner;
  const bIsLoser = hasLoser && !bIsWinner;

  const hasGames = games.length > 0;
  const isProjected = !hasGames && teamA && teamB;
  const isPlayIn = series.round === "play_in" && games.length === 1;
  const isSingleGameLink = isPlayIn || (games.length === 1 && isComplete);
  const canExpand = hasGames && !isSingleGameLink && games.length > 1;

  const cardClasses = `block bg-surface-elevated border border-white/[0.08] rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
    canExpand || isSingleGameLink ? "hover:border-white/[0.14]" : ""
  }`;

  const showWins = !isSingleGameLink;
  const singleGame = isSingleGameLink ? games[0] : null;
  const scoreA = singleGame
    ? (teamA?.id === singleGame.homeTeamId ? singleGame.homescore : singleGame.awayscore) ?? "–"
    : null;
  const scoreB = singleGame
    ? (teamB?.id === singleGame.homeTeamId ? singleGame.homescore : singleGame.awayscore) ?? "–"
    : null;

  const teamRows = (
    <>
      <TeamRow
        team={teamA}
        wins={showWins ? winsA : scoreA}
        isWinner={aIsWinner}
        isLoser={aIsLoser}
      />
      <div className="h-px bg-white/[0.05]" />
      <TeamRow
        team={teamB}
        wins={showWins ? winsB : scoreB}
        isWinner={bIsWinner}
        isLoser={bIsLoser}
      />
      {isProjected && (
        <div className="text-[10px] uppercase tracking-wider text-text-tertiary text-center py-1 border-t border-white/[0.05]">
          Projected
        </div>
      )}
    </>
  );

  // Single-game series: navigate directly to the game.
  if (isSingleGameLink) {
    return (
      <Link
        to={`/${league}/games/${games[0].id}`}
        onMouseEnter={() =>
          queryClient.prefetchQuery({
            queryKey: queryKeys.game(league, games[0].id),
            queryFn: queryFns.game(league, games[0].id),
            staleTime: 10_000,
          })
        }
        className={cardClasses}
      >
        {teamRows}
      </Link>
    );
  }

  return (
    <div className={cardClasses}>
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        className={`w-full text-left ${canExpand ? "cursor-pointer" : "cursor-default"}`}
        aria-expanded={expanded}
      >
        {teamRows}
      </button>

      <AnimatePresence initial={false}>
        {expanded && hasGames && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-white/[0.06] bg-surface-base/50"
          >
            <div className="p-2 space-y-1">
              {games.map((g, i) => {
                const homeWon = g.winnerid === g.homeTeamId;
                const awayWon = g.winnerid === g.awayTeamId;
                const winnerTeam =
                  g.winnerid === teamA?.id
                    ? teamA
                    : g.winnerid === teamB?.id
                    ? teamB
                    : null;
                return (
                  <Link
                    key={g.id}
                    to={`/${league}/games/${g.id}`}
                    onMouseEnter={() =>
                      queryClient.prefetchQuery({
                        queryKey: queryKeys.game(league, g.id),
                        queryFn: queryFns.game(league, g.id),
                        staleTime: 10_000,
                      })
                    }
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors duration-150 text-[11px]"
                  >
                    <span className="text-text-tertiary tabular-nums w-6 flex-shrink-0">
                      G{i + 1}
                    </span>
                    <span className="text-text-tertiary tabular-nums w-10 flex-shrink-0">
                      {formatDateNumeric(g.date)}
                    </span>
                    <span className="flex-1 flex items-center justify-end gap-1.5 tabular-nums text-text-primary">
                      <span className={awayWon ? "font-semibold text-win" : "font-normal"}>
                        {g.awayscore ?? "–"}
                      </span>
                      <span className="text-text-tertiary">–</span>
                      <span className={homeWon ? "font-semibold text-win" : "font-normal"}>
                        {g.homescore ?? "–"}
                      </span>
                      {winnerTeam?.logo_url ? (
                        <img
                          loading="lazy"
                          src={winnerTeam.logo_url}
                          alt=""
                          className="w-4 h-4 object-contain flex-shrink-0 ml-1"
                        />
                      ) : (
                        <span className="w-4 h-4 flex-shrink-0 ml-1" />
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
