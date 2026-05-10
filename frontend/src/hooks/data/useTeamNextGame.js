import { useQuery } from "@tanstack/react-query";
import { getTeamNextGame } from "../../api/teams.js";
import { queryKeys } from "../../lib/query.js";

export function useTeamNextGame(league, teamId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: queryKeys.teamNextGame(league, teamId),
    queryFn: ({ signal }) => getTeamNextGame(league, teamId, { signal }),
    enabled: !!league && !!teamId && enabled,
    staleTime: 5 * 60 * 1000,
  });

  return {
    nextGame: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
