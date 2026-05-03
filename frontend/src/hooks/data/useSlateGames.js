import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLeagueGames } from "../../api/games.js";
import { useLiveGames } from "../live/useLiveGames.js";
import { queryKeys } from "../../lib/query.js";
import { getSlateDateET, statusGroup } from "../../utils/slateDate.js";

function hasLiveGame(games) {
  return games.some((g) => statusGroup(g) === "live");
}

export function useSlateGames(league, { enabled = true } = {}) {
  const queryClient = useQueryClient();
  const slateDate = getSlateDateET();

  const query = useQuery({
    queryKey: queryKeys.leagueGames(league, null, slateDate),
    queryFn: ({ signal }) =>
      getLeagueGames(league, { date: slateDate, signal }),
    enabled,
    staleTime: 0,
  });

  // Backend returns either { games, resolvedDate, resolvedSeason } (when a
  // date is passed) or a plain array. Normalize.
  const raw = query.data;
  let games = [];
  let resolvedDate = null;
  if (raw && !Array.isArray(raw)) {
    games = raw.games ?? [];
    resolvedDate = raw.resolvedDate ?? null;
  } else if (Array.isArray(raw)) {
    games = raw;
  }

  // SSE subscription gated on live games to avoid idle EventSources.
  const sseLeague = enabled && hasLiveGame(games) ? league : null;
  const { liveGames } = useLiveGames(sseLeague);

  // Fold SSE updates back into the same cache key the query uses, so the rail
  // updates without refetching. Mirrors useLeagueData's pump.
  useEffect(() => {
    if (!liveGames || !sseLeague) return;
    const payload = liveGames.filter((g) => {
      const d = typeof g.date === "string" ? g.date.slice(0, 10) : "";
      return d === slateDate;
    });
    queryClient.setQueryData(
      queryKeys.leagueGames(league, null, slateDate),
      { games: payload, resolvedDate, resolvedSeason: null }
    );
  }, [liveGames, sseLeague, queryClient, league, slateDate, resolvedDate]);

  return {
    games,
    resolvedDate,
    loading: query.isLoading,
    error: query.isError,
  };
}
