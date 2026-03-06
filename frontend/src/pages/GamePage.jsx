import { Link, useParams, useLocation } from "react-router-dom";
import { useEffect } from "react";

import BoxScore from "../components/ui/BoxScore.jsx";
import AISummary from "../components/ui/AISummary.jsx";
import slugify from "../utilities/slugify.js";
import computeTopPlayers from "../utilities/topPlayers.js";
import TopPerformerCard from "../components/cards/TopPerformerCard.jsx";
import LoadingPage from "./LoadingPage.jsx";
import formatDate from "../utilities/formatDate.js";
import { useGame } from "../hooks/useGame.js";

export default function GamePage() {
  const location = useLocation();
  const { league, gameId } = useParams();
  const { gameData, loading, error } = useGame(league, gameId);

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

  if (loading) return <LoadingPage />;
  if (error || !gameData?.json_build_object) {
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
  const isFinal = game.status.includes("Final");
  const inProgress =
    game.status.includes("In Progress") ||
    game.status.includes("End of Period");
  const homeWon = isFinal && game.winnerId === homeTeam.info.id;
  const awayWon = isFinal && game.winnerId === awayTeam.info.id;
  const nhl = league === "nhl";
  const isPlayoffGame = game.gameLabel && game.gameLabel.toLowerCase() !== "Preseason";
  const isChampionship = isPlayoffGame && (
    game.gameLabel.toLowerCase().includes("nba finals") ||
    game.gameLabel.toLowerCase().includes("stanley cup") ||
    game.gameLabel.toLowerCase().includes("super bowl")
  );
  const playoffLogo = isPlayoffGame
    ? `/${league.toUpperCase()}/${league.toUpperCase()}${isChampionship ? "Final" : "Playoff"}.png`
    : null;
  const quarterKeys = nhl ? ["q1", "q2", "q3"] : ["q1", "q2", "q3", "q4"];

  const allPlayerStats = [
    ...(homeTeam?.players || []),
    ...(awayTeam?.players || []),
  ];

  const { topPerformer, topScorer, impactPlayer } = computeTopPlayers(
    game,
    allPlayerStats,
    league
  );

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
            src={homeTeam.info.logoUrl}
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
              <div className={`text-3xl sm:text-5xl font-bold tabular-nums mt-1 ${scoreColor(homeWon, awayWon && isFinal)}`}>
                {game.score.home}
              </div>
            )}
          </div>
        </div>

        {/* VS divider */}
        <div className="flex flex-col items-center gap-1.5">
          {playoffLogo && (
            <div className="h-24 w-48 flex items-center justify-center mb-0.5">
              <img src={playoffLogo} alt={game.gameLabel} className="max-h-full max-w-full object-contain" />
            </div>
          )}
          <span className="text-sm font-medium text-text-tertiary">vs</span>
          {inProgress && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-live bg-live/10 px-2 py-0.5 rounded-full">
              Live
            </span>
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
              <div className={`text-3xl sm:text-5xl font-bold tabular-nums mt-1 ${scoreColor(awayWon, homeWon && isFinal)}`}>
                {game.score.away}
              </div>
            )}
          </div>
          <img
            src={awayTeam.info.logoUrl}
            alt={`${awayTeam.info.name} logo`}
            className="w-20 h-20 sm:w-28 sm:h-28 object-contain order-1 sm:order-2"
            onError={(e) => { e.target.onerror = null; e.target.src = "/backupTeamLogo.webp"; }}
          />
        </div>
      </div>

      {/* Game info + Top performers */}
      <div className="flex flex-col lg:flex-row gap-6 mb-10">
        {/* Game info card */}
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)] shrink-0">
          <div className="grid grid-cols-[max-content_auto] gap-x-8 gap-y-3">
            <span className="text-sm text-text-tertiary">Date</span>
            <span className="text-sm font-medium text-text-primary">{formatDate(game.date)}</span>
            <span className="text-sm text-text-tertiary">Status</span>
            <span className="text-sm font-medium text-text-primary">{game.status}</span>
            <span className="text-sm text-text-tertiary">Location</span>
            <span className="text-sm font-medium text-text-primary">{game.venue}</span>
            {game.broadcast && (
              <>
                <span className="text-sm text-text-tertiary">Broadcast</span>
                <span className="text-sm font-medium text-text-primary">{game.broadcast}</span>
              </>
            )}
          </div>
        </div>

        {/* Top performers */}
        <div className="flex-1 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <TopPerformerCard title="Top Performer" player={topPerformer} league={league} />
          <TopPerformerCard title="Top Scorer"    player={topScorer}    league={league} />
          <TopPerformerCard title="Impact Player" player={impactPlayer} league={league} />
        </div>
      </div>

      {/* Quarter-by-quarter */}
      {(isFinal || inProgress) && (
        <div className="max-w-2xl mx-auto mb-2">
          <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <ul className="text-sm text-text-secondary font-mono space-y-2">
              {/* Header */}
              <li className="flex items-center justify-center gap-x-6 text-text-tertiary text-xs uppercase tracking-widest">
                <span className="w-24" />
                {quarterKeys.map((_, i) => (
                  <span key={i} className="w-10 text-center">{i + 1}</span>
                ))}
                {game.score.quarters.ot.map(
                  (val, i) =>
                    val && (
                      <span key={`OT${i + 1}`} className="w-10 text-center">OT{i > 0 ? i + 1 : ""}</span>
                    )
                )}
                <span className="w-10 text-center font-semibold text-text-secondary">T</span>
              </li>

              {/* Home */}
              <li className="flex items-center justify-center gap-x-6">
                <span className="w-24 font-semibold text-left text-text-primary text-sm">
                  {homeTeam.info.shortName}
                </span>
                {quarterKeys.map((q) => (
                  <span key={q} className="w-10 text-center text-sm">
                    {game.score.quarters[q]?.split("-")[0] ?? "–"}
                  </span>
                ))}
                {game.score.quarters.ot.map(
                  (val, i) =>
                    val && (
                      <span key={`home-OT${i + 1}`} className="w-10 text-center">{val.split("-")[0]}</span>
                    )
                )}
                <span className={`w-10 text-center font-bold text-sm tabular-nums ${scoreColor(homeWon, awayWon && isFinal)}`}>
                  {isFinal && game.score.home}
                </span>
              </li>

              {/* Away */}
              <li className="flex items-center justify-center gap-x-6">
                <span className="w-24 font-semibold text-left text-text-primary text-sm">
                  {awayTeam.info.shortName}
                </span>
                {quarterKeys.map((q) => (
                  <span key={q} className="w-10 text-center text-sm">
                    {game.score.quarters[q]?.split("-")[1] ?? "–"}
                  </span>
                ))}
                {game.score.quarters.ot.map(
                  (val, i) =>
                    val && (
                      <span key={`away-OT${i + 1}`} className="w-10 text-center">{val.split("-")[1]}</span>
                    )
                )}
                <span className={`w-10 text-center font-bold text-sm tabular-nums ${scoreColor(awayWon, homeWon && isFinal)}`}>
                  {isFinal && game.score.away}
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}

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
