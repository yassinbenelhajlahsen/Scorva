import { useQuery } from "@tanstack/react-query";
import { getWinProbability } from "../../api/games.js";
import { queryKeys } from "../../lib/query.js";

export function useWinProbability(league, eventId, { isFinal = false, isLive = false } = {}) {
  const { data: rawData, isLoading: loading, isError: error } = useQuery({
    queryKey: queryKeys.winProbability(league, eventId, isFinal),
    queryFn: ({ signal }) =>
      getWinProbability(league, eventId, { signal, isFinal }),
    enabled: !!league && !!eventId,
    staleTime: 0,
    refetchInterval: isLive ? 30_000 : false,
  });

  // Normalize response shape (new nested vs. legacy flat-array)
  const respData = rawData?.data;
  let data = null;
  let scoreMargin = null;
  if (respData?.winProbability) {
    data = respData.winProbability;
    scoreMargin = respData.scoreMargin ?? null;
  } else {
    data = respData ?? null;
  }

  return { data, scoreMargin, loading, error };
}
