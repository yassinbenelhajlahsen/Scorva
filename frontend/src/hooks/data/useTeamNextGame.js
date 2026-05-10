import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeamNextGame } from "../../api/teams.js";
import { queryKeys } from "../../lib/query.js";
import { useLiveGames } from "../live/useLiveGames.js";

export function useTeamNextGame(league, teamId, { enabled = true } = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.teamNextGame(league, teamId),
    queryFn: ({ signal }) => getTeamNextGame(league, teamId, { signal }),
    enabled: !!league && !!teamId && enabled,
    staleTime: 5 * 60 * 1000,
  });

  // When the team has a live game, subscribe to the league SSE so the card's
  // score, period, and clock stay current. When the live game ends, invalidate
  // so the next-scheduled game replaces it.
  const game = query.data;
  const isLive = game?.kind === "live";
  const { liveGames } = useLiveGames(isLive ? league : null);

  useEffect(() => {
    if (!isLive || !liveGames || !game?.id) return;
    const fresh = liveGames.find((g) => g.id === game.id);
    if (!fresh) return;

    if (fresh.status?.includes("Final")) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.teamNextGame(league, teamId),
      });
      return;
    }

    queryClient.setQueryData(
      queryKeys.teamNextGame(league, teamId),
      (prev) => {
        if (!prev || prev.kind !== "live" || prev.id !== fresh.id) return prev;
        return {
          ...prev,
          status: fresh.status,
          teamScore: prev.isHome ? fresh.homescore : fresh.awayscore,
          opponentScore: prev.isHome ? fresh.awayscore : fresh.homescore,
          currentPeriod: fresh.current_period,
          clock: fresh.clock,
        };
      },
    );
  }, [liveGames, isLive, game?.id, league, teamId, queryClient]);

  return {
    nextGame: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
