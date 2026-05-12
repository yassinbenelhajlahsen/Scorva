import { useState, useEffect } from "react";
import { getLiveGamesUrl, getLeagueGames } from "../../api/games.js";
import { useVisibilityReconnect } from "./useVisibilityReconnect.js";
import { subscribeSSE, forceReconnect } from "./sharedSSE.js";

const VOLATILE_FIELDS = ["id", "status", "homescore", "awayscore", "current_period", "clock"];

function projectVolatile(row) {
  const out = {};
  for (const k of VOLATILE_FIELDS) out[k] = row[k];
  return out;
}

function mergePartial(map, partial) {
  const prev = map.get(partial.id);
  // Final is terminal — once a row is Final, never let a later non-Final
  // partial overwrite it (defends against ESPN status flap).
  if (prev?.status?.startsWith("Final") && !partial.status?.startsWith("Final")) {
    return;
  }
  map.set(partial.id, { ...prev, ...partial });
}

function accumulate(prev, next) {
  const map = new Map(prev ?? []);
  if (Array.isArray(next)) {
    // fetchFallback path — full Game[] from REST.
    for (const row of next) {
      if (row?.id == null) continue;
      mergePartial(map, projectVolatile(row));
    }
  } else if (next && typeof next === "object" && next.id != null) {
    mergePartial(map, next);
  }
  return map;
}

export function useLiveGames(league) {
  const [liveGamesMap, setLiveGamesMap] = useState(null);
  const [streamError, setStreamError] = useState(false);

  useVisibilityReconnect(() => {
    if (league) forceReconnect(getLiveGamesUrl(league));
  }, !!league);

  useEffect(() => {
    if (!league) {
      setLiveGamesMap(null);
      setStreamError(false);
      return undefined;
    }
    const url = getLiveGamesUrl(league);
    return subscribeSSE(
      url,
      {
        fetchFallback: () => getLeagueGames(league),
        accumulate,
      },
      ({ data, streamError: e }) => {
        if (data !== undefined) setLiveGamesMap(data);
        if (e !== undefined) setStreamError(e);
      },
    );
  }, [league]);

  return { liveGamesMap, streamError };
}
