import { useMemo } from "react";
import { useSlateGames } from "./useSlateGames.js";
import { getSlateDateET, sortBySlateOrder } from "../../utils/slateDate.js";

function isInScope(league, leagueFilter) {
  return leagueFilter === null || leagueFilter === league;
}

function shouldDropLeague(slateDate, source) {
  // Off-season signal: backend redirects to an earlier resolvedDate when
  // today has no games. Drop that league's contribution silently.
  return source.resolvedDate !== null && source.resolvedDate !== slateDate;
}

export function useScoresBar(leagueFilter) {
  const slateDate = getSlateDateET();

  // Always call the hook for every league (Hooks rules), gate via `enabled`.
  const nba = useSlateGames("nba", { enabled: isInScope("nba", leagueFilter) });
  const nfl = useSlateGames("nfl", { enabled: isInScope("nfl", leagueFilter) });
  const nhl = useSlateGames("nhl", { enabled: isInScope("nhl", leagueFilter) });

  const sources = [
    { league: "nba", ...nba },
    { league: "nfl", ...nfl },
    { league: "nhl", ...nhl },
  ].filter((s) => isInScope(s.league, leagueFilter));

  const games = useMemo(() => {
    const merged = [];
    for (const src of sources) {
      if (shouldDropLeague(slateDate, src)) continue;
      for (const g of src.games) merged.push({ ...g, league: src.league });
    }
    return sortBySlateOrder(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    slateDate,
    nba.games,
    nba.resolvedDate,
    nfl.games,
    nfl.resolvedDate,
    nhl.games,
    nhl.resolvedDate,
    leagueFilter,
  ]);

  // loading: all in-scope sources still loading
  const loading = sources.every((s) => s.loading);
  // error: every in-scope source errored (per-league errors silently drop)
  const error = sources.length > 0 && sources.every((s) => s.error);

  return { games, loading, error };
}
