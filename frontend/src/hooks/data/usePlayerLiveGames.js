import { useMemo } from "react";
import { useLiveGames } from "../live/useLiveGames.js";

function isLiveStatus(status) {
  if (!status) return false;
  return (
    status.includes("In Progress") ||
    status.includes("Halftime") ||
    status.includes("End of Period")
  );
}

// Builds a map of { [gameId]: { status, current_period, clock, homescore, awayscore } }
// using live SSE updates. The SSE subscription only opens when at least one of
// the player's games is currently in progress.
export function usePlayerLiveGames(league, games) {
  const hasLive = useMemo(
    () => Array.isArray(games) && games.some((g) => isLiveStatus(g.status)),
    [games],
  );
  const { liveGamesMap } = useLiveGames(hasLive ? league : null);

  return useMemo(() => {
    if (!liveGamesMap || liveGamesMap.size === 0) return {};
    const ids = new Set(
      (games || []).map((g) => g.gameid).filter((id) => id != null),
    );
    const map = {};
    for (const [id, partial] of liveGamesMap) {
      if (!ids.has(id)) continue;
      map[id] = {
        status: partial.status,
        current_period: partial.current_period,
        clock: partial.clock,
        homescore: partial.homescore,
        awayscore: partial.awayscore,
      };
    }
    return map;
  }, [liveGamesMap, games]);
}
