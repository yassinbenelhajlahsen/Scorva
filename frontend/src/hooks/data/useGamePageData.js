import { useGame } from "./useGame.js";
import { usePrediction } from "./usePrediction.js";
import { useWinProbability } from "./useWinProbability.js";

export function useGamePageData(league, gameId) {
  const { gameData, loading, error, retry } = useGame(league, gameId);

  const staleStatus = gameData?.json_build_object?.game?.status ?? "";
  const isFinalEarly = staleStatus.includes("Final");
  const inProgressEarly =
    staleStatus.includes("In Progress") ||
    staleStatus.includes("Halftime") ||
    staleStatus.includes("End of Period");
  const staleIsPreGame = !!staleStatus && !isFinalEarly && !inProgressEarly;

  const { prediction, loading: predictionLoading } = usePrediction(
    league,
    gameId,
    staleIsPreGame,
  );

  const eventId = gameData?.json_build_object?.game?.eventId;
  const showWinProb = (isFinalEarly || inProgressEarly) && !!eventId;
  const { data: winProbData, scoreMargin } = useWinProbability(
    showWinProb ? league : null,
    showWinProb ? eventId : null,
    { isFinal: isFinalEarly, isLive: inProgressEarly },
  );

  return {
    gameData,
    loading,
    error,
    retry,
    staleIsPreGame,
    prediction,
    predictionLoading,
    winProbData,
    scoreMargin,
  };
}
