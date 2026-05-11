import { useQuery } from "@tanstack/react-query";
import { getTeamRankings } from "../../api/teams.js";
import { queryKeys } from "../../lib/query.js";

export function useTeamRankings(league, teamId) {
  const isNba = league?.toLowerCase() === "nba";
  const { data } = useQuery({
    queryKey: queryKeys.teamRankings(league, teamId),
    queryFn: ({ signal }) =>
      getTeamRankings(league, teamId, { signal }).then((d) => d.rankings),
    enabled: isNba && !!teamId,
    staleTime: 60_000,
  });
  return data ?? null;
}
