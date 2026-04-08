import { useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getTeams, getStandings, getTeamSeasons } from "../../api/teams.js";
import { getTeamGames } from "../../api/games.js";
import slugify from "../../utils/slugify.js";
import { queryKeys } from "../../lib/query.js";

export function useTeam(league, teamId, selectedSeason) {
  // Phase 1: resolve slug → team object
  const teamQuery = useQuery({
    queryKey: queryKeys.team(league, teamId),
    queryFn: async ({ signal }) => {
      const teamList = await getTeams(league, { signal });
      const found = teamList.find(
        (t) => slugify(t.name) === teamId || slugify(t.shortname || "") === teamId
      );
      if (!found) throw new Error("Team not found.");
      return found;
    },
  });

  // Phase 1b: team seasons (fire-and-forget, depends on team)
  const seasonsQuery = useQuery({
    queryKey: queryKeys.teamSeasons(league, teamQuery.data?.id),
    queryFn: ({ signal }) =>
      getTeamSeasons(league, teamQuery.data.id, { signal }),
    enabled: !!teamQuery.data,
    staleTime: 10 * 60 * 1000,
  });

  // Phase 2: games + standings (depends on team, shows prev on season change)
  const gamesQuery = useQuery({
    queryKey: queryKeys.teamGames(league, teamQuery.data?.id, selectedSeason),
    queryFn: async ({ signal }) => {
      const [gamesData, standingsData] = await Promise.all([
        getTeamGames(league, teamQuery.data.id, { season: selectedSeason, signal }),
        getStandings(league, { season: selectedSeason, signal }),
      ]);

      const sorted = gamesData
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const finalGames = gamesData.filter((g) => /final/i.test(g.status ?? ""));
      const homeGames = finalGames.filter((g) => g.hometeamid === teamQuery.data.id);
      const homeWins = homeGames.filter(
        (g) => g.winnerid === g.hometeamid
      ).length;
      const awayGames = finalGames.filter((g) => g.awayteamid === teamQuery.data.id);
      const awayWins = awayGames.filter(
        (g) => g.winnerid === g.awayteamid
      ).length;

      const isNHL = league === "nhl";
      const otStatuses = ["Final/OT", "Final/SO"];
      const homeOTL = isNHL
        ? homeGames.filter((g) => g.winnerid !== g.hometeamid && otStatuses.includes(g.status)).length
        : 0;
      const awayOTL = isNHL
        ? awayGames.filter((g) => g.winnerid !== g.awayteamid && otStatuses.includes(g.status)).length
        : 0;

      const standing = standingsData.find((t) => t.id === teamQuery.data.id);

      const homeLosses = homeGames.length - homeWins;
      const awayLosses = awayGames.length - awayWins;

      return {
        games: sorted,
        teamRecord: standing
          ? (isNHL
            ? `${standing.wins}-${standing.losses - (standing.otl || 0)}-${standing.otl || 0}`
            : `${standing.wins}-${standing.losses}`)
          : null,
        homeRecord: isNHL
          ? `${homeWins}-${homeLosses - homeOTL}-${homeOTL}`
          : `${homeWins}-${homeLosses}`,
        awayRecord: isNHL
          ? `${awayWins}-${awayLosses - awayOTL}-${awayOTL}`
          : `${awayWins}-${awayLosses}`,
      };
    },
    enabled: !!teamQuery.data,
    placeholderData: keepPreviousData,
  });

  const loading = teamQuery.isLoading;
  const seasonLoading = gamesQuery.isPlaceholderData && gamesQuery.isFetching;
  const error =
    teamQuery.error?.message ?? gamesQuery.error?.message ?? null;

  const retry = useCallback(() => {
    teamQuery.refetch();
  }, [teamQuery]);

  return {
    team: teamQuery.data ?? null,
    games: gamesQuery.data?.games ?? [],
    availableSeasons: seasonsQuery.data ?? [],
    teamRecord: gamesQuery.data?.teamRecord ?? null,
    homeRecord: gamesQuery.data?.homeRecord ?? null,
    awayRecord: gamesQuery.data?.awayRecord ?? null,
    loading,
    seasonLoading,
    error,
    retry,
  };
}
