import { useQuery } from "@tanstack/react-query";
import { getGamePrediction } from "../../api/games.js";
import { queryKeys } from "../../lib/query.js";

export function usePrediction(league, gameId, enabled) {
  const {
    data: prediction = null,
    isLoading: loading,
    isError: error,
  } = useQuery({
    queryKey: queryKeys.prediction(league, gameId),
    queryFn: ({ signal }) => getGamePrediction(league, gameId, { signal }),
    enabled: !!enabled,
    staleTime: 5 * 60 * 1000,
  });
  return { prediction, loading, error };
}
