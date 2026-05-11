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
        <div className="relative mb-6">
          <div className="font-mono text-sm w-full">
            <div className="flex items-center gap-x-4 text-[10px] uppercase tracking-[0.18em] text-text-tertiary pb-3 border-b border-white/[0.08]">
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
                  className="w-10 text-center shrink-0 text-text-secondary tabular-nums"
                >
                  {game.score.quarters[q]?.split("-")[0] ?? "–"}
                </span>
              ))}
              {game.score.quarters.ot.map(
                (val, i) =>
                  val && (
                    <span
                      key={`home-OT${i + 1}`}
                      className="w-10 text-center shrink-0 text-text-secondary tabular-nums"
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
                  className="w-10 text-center shrink-0 text-text-secondary tabular-nums"
                >
                  {game.score.quarters[q]?.split("-")[1] ?? "–"}
                </span>
              ))}
              {game.score.quarters.ot.map(
                (val, i) =>
                  val && (
                    <span
                      key={`away-OT${i + 1}`}
                      className="w-10 text-center shrink-0 text-text-secondary tabular-nums"
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

      {/* Prediction — pre-game only; hidden when a prior playoff series game is still pending */}
      {isPreGame && game?.hasUnplayedPriorSeriesGames ? (
        <div className="relative overflow-hidden rounded-2xl mb-6">
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent/60" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.8) 0 1px, transparent 1px 12px)",
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-20"
            style={{ background: "radial-gradient(circle, #e8863a 0%, transparent 70%)" }}
          />

          <div className="relative flex items-start gap-4 p-5">
            <div className="shrink-0 w-11 h-11 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-accent"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-sm font-semibold text-text-primary tracking-tight">
                  Prediction Locked
                </h3>
              </div>
              <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
                Prediction available after the previous game in this series finishes.
              </p>
            </div>
          </div>
        </div>
      ) : (
        isPreGame &&
        (prediction || predictionLoading) && (
          <PredictionCard
            prediction={prediction}
            loading={predictionLoading}
            league={league}
            homeColor={homeTeam?.info?.color}
            awayColor={awayTeam?.info?.color}
          />
        )
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
          isFinal={isFinal}
        />
      )}
    </>
  );
}
