import GameChart from "../ui/GameChart.jsx";
import TopPerformerCard from "../cards/TopPerformerCard.jsx";
import PredictionCard from "../cards/PredictionCard.jsx";

export default function OverviewTab({
  game,
  homeTeam,
  awayTeam,
  league,
  season,
  quarterKeys,
  isFinal,
  inProgress,
  isPreGame,
  homeWon,
  awayWon,
  scoreColor,
  prediction,
  predictionLoading,
  topPlayers,
  winProbData,
  scoreMargin,
}) {
  const { topPerformer, topScorer, impactPlayer } = topPlayers;

  return (
    <>
      {/* Quarter-by-quarter */}
      {(isFinal || inProgress) && (
        <div className="bg-surface-elevated border border-white/[0.08] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] mb-6">
          <div className="font-mono text-sm w-full">
            <div className="flex items-center gap-x-4 text-[10px] uppercase tracking-widest text-text-tertiary pb-3 border-b border-white/[0.06]">
              <span className="flex-1 min-w-0">Team</span>
              {quarterKeys.map((_, i) => (
                <span key={i} className="w-10 text-center shrink-0">
                  {i + 1}
                </span>
              ))}
              {game.score.quarters.ot.map(
                (val, i) =>
                  val && (
                    <span
                      key={`OT${i + 1}`}
                      className="w-10 text-center shrink-0"
                    >
                      {i === 0 ? "OT" : `OT${i + 1}`}
                    </span>
                  ),
              )}
              <span className="w-10 text-center shrink-0 font-semibold text-text-secondary">
                T
              </span>
            </div>
            <div className="flex items-center gap-x-4 py-3">
              <span className="flex-1 min-w-0 font-semibold text-text-primary truncate">
                {homeTeam.info.shortName}
              </span>
              {quarterKeys.map((q) => (
                <span
                  key={q}
                  className="w-10 text-center shrink-0 text-text-secondary"
                >
                  {game.score.quarters[q]?.split("-")[0] ?? "–"}
                </span>
              ))}
              {game.score.quarters.ot.map(
                (val, i) =>
                  val && (
                    <span
                      key={`home-OT${i + 1}`}
                      className="w-10 text-center shrink-0 text-text-secondary"
                    >
                      {val.split("-")[0]}
                    </span>
                  ),
              )}
              <span
                className={`w-10 text-center shrink-0 font-bold tabular-nums ${scoreColor(homeWon, awayWon && isFinal)}`}
              >
                {game.score.home}
              </span>
            </div>
            <div className="border-t border-white/[0.04]" />
            <div className="flex items-center gap-x-4 py-3">
              <span className="flex-1 min-w-0 font-semibold text-text-primary truncate">
                {awayTeam.info.shortName}
              </span>
              {quarterKeys.map((q) => (
                <span
                  key={q}
                  className="w-10 text-center shrink-0 text-text-secondary"
                >
                  {game.score.quarters[q]?.split("-")[1] ?? "–"}
                </span>
              ))}
              {game.score.quarters.ot.map(
                (val, i) =>
                  val && (
                    <span
                      key={`away-OT${i + 1}`}
                      className="w-10 text-center shrink-0 text-text-secondary"
                    >
                      {val.split("-")[1]}
                    </span>
                  ),
              )}
              <span
                className={`w-10 text-center shrink-0 font-bold tabular-nums ${scoreColor(awayWon, homeWon && isFinal)}`}
              >
                {game.score.away}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Prediction — pre-game only */}
      {isPreGame && (prediction || predictionLoading) && (
        <PredictionCard
          prediction={prediction}
          loading={predictionLoading}
          league={league}
          homeColor={homeTeam?.info?.color}
          awayColor={awayTeam?.info?.color}
        />
      )}

      {/* Top performers — live/final */}
      {!isPreGame && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          <TopPerformerCard
            title="Top Performer"
            player={topPerformer}
            league={league}
            season={season}
          />
          <TopPerformerCard
            title="Top Scorer"
            player={topScorer}
            league={league}
            season={season}
          />
          <TopPerformerCard
            title="Impact Player"
            player={impactPlayer}
            league={league}
            season={season}
          />
        </div>
      )}

      {/* Chart — live/final */}
      {winProbData && (
        <GameChart
          data={winProbData}
          scoreMargin={scoreMargin}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          league={league}
        />
      )}
    </>
  );
}
