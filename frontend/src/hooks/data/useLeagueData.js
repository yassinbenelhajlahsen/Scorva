import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLeagueGames } from "../../api/games.js";
import { getStandings } from "../../api/teams.js";
import { useLiveGames } from "../live/useLiveGames.js";
import { queryKeys } from "../../lib/query.js";

function hasLiveGame(games) {
  return games.some(
    (g) =>
      g.status.includes("In Progress") ||
      g.status.includes("End of Period") ||
      g.status.includes("Halftime")
  );
}

export function useLeagueData(league, selectedSeason, selectedDate) {
  const queryClient = useQueryClient();
  const [displayData, setDisplayData] = useState(false);

  // Games query — keyed by league+season+date so date changes don't re-fetch standings
  const gamesQuery = useQuery({
    queryKey: queryKeys.leagueGames(league, selectedSeason, selectedDate),
    queryFn: ({ signal }) =>
      getLeagueGames(league, { season: selectedSeason, date: selectedDate, signal }),
    staleTime: 0,
  });

  // Standings query — keyed by league+season only, so date changes don't re-fetch
  const standingsQuery = useQuery({
    queryKey: queryKeys.standings(league, selectedSeason),
    queryFn: async ({ signal }) => {
      const teams = await getStandings(league, { season: selectedSeason, signal });
      const isNFL = league === "nfl";
      const east = teams.filter(
        (t) => t.conf?.toLowerCase() === (isNFL ? "afc" : "east")
      );
      const west = teams.filter(
        (t) => t.conf?.toLowerCase() === (isNFL ? "nfc" : "west")
      );
      return { eastOrAFC: east, westOrNFC: west };
    },
    staleTime: 5 * 60 * 1000,
  });

  // Normalize games response shape
  let games = [];
  let resolvedDate = null;
  let resolvedSeason = null;
  const raw = gamesQuery.data;
  if (selectedDate && raw && !Array.isArray(raw)) {
    games = raw.games ?? [];
    resolvedDate = raw.resolvedDate ?? null;
    resolvedSeason = raw.resolvedSeason ?? null;
  } else if (Array.isArray(raw)) {
    games = raw;
  }

  // Activate SSE when viewing today with live games
  const todayET = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const { liveGames } = useLiveGames(
    selectedSeason === null &&
      (selectedDate === null || selectedDate === todayET) &&
      hasLiveGame(games)
      ? league
      : null
  );

  // Push SSE updates into the games query cache
  useEffect(() => {
    if (!liveGames) return;
    const updated = selectedDate
      ? { games: liveGames, resolvedDate, resolvedSeason }
      : liveGames;
    queryClient.setQueryData(
      queryKeys.leagueGames(league, selectedSeason, selectedDate),
      updated
    );
  }, [liveGames, queryClient, league, selectedSeason, selectedDate, resolvedDate, resolvedSeason]);

  // Preserve 50ms display delay for animation timing
  useEffect(() => {
    if (!gamesQuery.isLoading && !standingsQuery.isLoading && gamesQuery.data !== undefined) {
      const timer = setTimeout(() => setDisplayData(true), 50);
      return () => clearTimeout(timer);
    }
  }, [gamesQuery.isLoading, standingsQuery.isLoading, gamesQuery.data]);

  // Reset displayData when league/season changes (but not date — gamesLoading handles that)
  useEffect(() => {
    setDisplayData(false);
  }, [league, selectedSeason]);

  const loading = !displayData && !gamesQuery.isError && !standingsQuery.isError;
  const gamesLoading = gamesQuery.isFetching && !gamesQuery.isLoading;
  const error =
    gamesQuery.isError || standingsQuery.isError ? "Failed to load data." : null;

  const retry = useCallback(() => {
    gamesQuery.refetch();
    standingsQuery.refetch();
  }, [gamesQuery, standingsQuery]);

  return {
    games,
    standings: standingsQuery.data ?? { eastOrAFC: [], westOrNFC: [] },
    loading,
    gamesLoading,
    error,
    displayData,
    retry,
    resolvedDate,
    resolvedSeason,
  };
}
