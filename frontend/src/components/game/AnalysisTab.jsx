import BoxScore from "../ui/BoxScore.jsx";
import AISummary from "../ui/AISummary.jsx";
import TeamComparison from "./TeamComparison.jsx";

export default function AnalysisTab({ gameId, homeTeam, awayTeam, league, season, isFinal, inProgress, gameRating }) {
  if (isFinal || inProgress) {
    return (
      <>
        {isFinal && <AISummary gameId={gameId} />}
        <TeamComparison
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          league={league}
          homeRating={gameRating?.home?.grade ?? null}
          awayRating={gameRating?.away?.grade ?? null}
        />
        <BoxScore
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          league={league}
          season={season}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-text-tertiary text-sm">
      No data available yet — check back when the game starts.
    </div>
  );
}
