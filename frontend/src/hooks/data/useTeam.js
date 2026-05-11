import { useCallback } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getTeams, getStandings, getTeamSeasons } from "../../api/teams.js";
import { getTeamGames } from "../../api/games.js";
import resolveTeam from "../../utils/resolveTeam.js";
import { queryKeys } from "../../lib/query.js";
import { recordFromGames, formatRecord } from "../../utils/recordFromGames.js";

function computeRanks(standings, teamId) {
  if (!Array.isArray(standings) || !teamId) return { confRank: null, divRank: null };
  const team = standings.find((t) => t.id === teamId);
  if (!team) return { confRank: null, divRank: null };

  const conf = (team.conf || "").toLowerCase();
  const division = (team.division || "").toLowerCase();

  let confRank = null;
  if (conf) {
    let pos = 0;
    for (const t of standings) {
      if ((t.conf || "").toLowerCase() === conf) {
        pos += 1;
        if (t.id === teamId) {
          confRank = pos;
          break;
        }
      }
    }
  }

  let divRank = null;
  if (division) {
    let pos = 0;
    for (const t of standings) {
      if ((t.division || "").toLowerCase() === division) {
        pos += 1;
        if (t.id === teamId) {
          divRank = pos;
          break;
        }
      }
    }
  }

  return { confRank, divRank, conf: team.conf ?? null, division: team.division ?? null };
}

export function useTeam(league, teamId, selectedSeason) {
  // Phase 1: resolve slug → team object
  const teamQuery = useQuery({
    queryKey: queryKeys.team(league, teamId),
    enabled: !!league && !!teamId,
    queryFn: async ({ signal }) => {
      const teamList = await getTeams(league, { signal });
      const found = resolveTeam(teamList, teamId);
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
      const teamIdResolved = teamQuery.data.id;
      const [gamesData, standingsData] = await Promise.all([
        getTeamGames(league, teamIdResolved, { season: selectedSeason, signal }),
        getStandings(league, { season: selectedSeason, signal }),
      ]);

      const sorted = gamesData
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      const isNHL = league === "nhl";
      const standing = standingsData.find((t) => t.id === teamIdResolved);
      const home = recordFromGames(gamesData, teamIdResolved, league, { side: "home" });
      const away = recordFromGames(gamesData, teamIdResolved, league, { side: "away" });
      const last10 = recordFromGames(gamesData, teamIdResolved, league, { limit: 10 });

      const teamRecord = standing
        ? (isNHL
          ? `${standing.wins}-${standing.losses - (standing.otl || 0)}-${standing.otl || 0}`
          : `${standing.wins}-${standing.losses}`)
        : null;

      const { confRank, divRank, conf, division } = computeRanks(standingsData, teamIdResolved);

      return {
        games: sorted,
        teamRecord,
        homeRecord: formatRecord(home, league),
        awayRecord: formatRecord(away, league),
        confRank,
        divRank,
        conf,
        division,
        last10: { ...last10, label: formatRecord(last10, league) },
      };
    },
    enabled: !!teamQuery.data,
    placeholderData: keepPreviousData,
  });

  const loading = teamQuery.isLoading;
  const recordsLoading = gamesQuery.isLoading;
  const seasonLoading = gamesQuery.isPlaceholderData && gamesQuery.isFetching;
  const error =
    teamQuery.error?.message ?? gamesQuery.error?.message ?? null;

  const retry = useCallback(() => {
    teamQuery.refetch();
  }, [teamQuery]);

  const refetch = useCallback(
    () =>
      Promise.allSettled([
        teamQuery.refetch(),
        seasonsQuery.refetch(),
        gamesQuery.refetch(),
      ]),
    [teamQuery, seasonsQuery, gamesQuery],
  );

  return {
    team: teamQuery.data ?? null,
    games: gamesQuery.data?.games ?? [],
    availableSeasons: seasonsQuery.data ?? [],
    teamRecord: gamesQuery.data?.teamRecord ?? null,
    homeRecord: gamesQuery.data?.homeRecord ?? null,
    awayRecord: gamesQuery.data?.awayRecord ?? null,
    confRank: gamesQuery.data?.confRank ?? null,
    divRank: gamesQuery.data?.divRank ?? null,
    conf: gamesQuery.data?.conf ?? null,
    division: gamesQuery.data?.division ?? null,
    last10: gamesQuery.data?.last10 ?? null,
    loading,
    recordsLoading,
    seasonLoading,
    error,
    retry,
    refetch,
  };
}
