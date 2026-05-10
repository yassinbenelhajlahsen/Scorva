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
  const { liveGames } = useLiveGames(hasLive ? league : null);

  return useMemo(() => {
    if (!Array.isArray(liveGames) || liveGames.length === 0) return {};
    const ids = new Set(
      (games || []).map((g) => g.gameid).filter((id) => id != null),
    );
    const map = {};
    for (const lg of liveGames) {
      if (!ids.has(lg.id)) continue;
      map[lg.id] = {
        status: lg.status,
        current_period: lg.current_period,
        clock: lg.clock,
        homescore: lg.homescore,
        awayscore: lg.awayscore,
      };
    }
    return map;
  }, [liveGames, games]);
}
