import { useQuery } from "@tanstack/react-query";
import { getSimilarPlayers } from "../../api/players.js";
import { queryKeys } from "../../lib/query.js";

export function useSimilarPlayers(league, slug, season) {
  const { data: players = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.similarPlayers(league, slug, season),
    queryFn: ({ signal }) =>
      getSimilarPlayers(league, slug, { season, signal }).then(
        (d) => d.players ?? []
      ),
    enabled: !!league && !!slug && !!season,
    staleTime: 5 * 60 * 1000,
  });
  return { players, loading };
}
