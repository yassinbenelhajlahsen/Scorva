import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlayoffs } from "../../api/playoffs.js";
import { queryKeys } from "../../lib/query.js";
import { LEAGUE_LABELS } from "../../constants/leagueLabels.js";

export function usePlayoffs(league, selectedSeason) {
  const query = useQuery({
    queryKey: queryKeys.playoffs(league, selectedSeason),
    queryFn: ({ signal }) =>
      getPlayoffs(league, { season: selectedSeason || undefined, signal }),
    staleTime: selectedSeason ? Infinity : 2 * 60 * 1000,
    enabled: LEAGUE_LABELS[league]?.playoffsSupported === true,
  });

  const retry = useCallback(() => query.refetch(), [query]);

  return {
    data: query.data,
    loading: query.isLoading,
    error: query.isError ? "Failed to load playoffs." : null,
    retry,
  };
}
