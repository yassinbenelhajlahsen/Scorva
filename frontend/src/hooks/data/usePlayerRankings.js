import { useQuery } from "@tanstack/react-query";
import { getPlayerRankings } from "../../api/players.js";
import { queryKeys } from "../../lib/query.js";

export function usePlayerRankings(league, slug) {
  const isNba = league?.toLowerCase() === "nba";
  const { data } = useQuery({
    queryKey: queryKeys.playerRankings(league, slug),
    queryFn: ({ signal }) =>
      getPlayerRankings(league, slug, { signal }).then((d) => d.rankings),
    enabled: isNba && !!slug,
    staleTime: 60_000,
  });
  return data ?? null;
}
