import { useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getTeamRoster } from "../../api/teams.js";
import { queryKeys } from "../../lib/query.js";

export function useTeamRoster(league, teamId, selectedSeason, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: queryKeys.teamRoster(league, teamId, selectedSeason),
    queryFn: ({ signal }) =>
      getTeamRoster(league, teamId, { season: selectedSeason, signal }),
    enabled: !!league && !!teamId && enabled,
    placeholderData: keepPreviousData,
  });

  const retry = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    roster: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    retry,
  };
}
