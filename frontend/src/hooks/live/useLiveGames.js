import { useState, useEffect } from "react";
import { getLiveGamesUrl, getLeagueGames } from "../../api/games.js";
import { useVisibilityReconnect } from "./useVisibilityReconnect.js";
import { subscribeSSE, forceReconnect } from "./sharedSSE.js";

export function useLiveGames(league) {
  const [liveGames, setLiveGames] = useState(null);
  const [streamError, setStreamError] = useState(false);

  // On tab return, force a reconnect — mobile PWAs and desktop sleep often
  // leave the EventSource silently dead even though readyState reports OPEN.
  useVisibilityReconnect(() => {
    if (league) forceReconnect(getLiveGamesUrl(league));
  }, !!league);

  useEffect(() => {
    if (!league) {
      setLiveGames(null);
      setStreamError(false);
      return undefined;
    }
    const url = getLiveGamesUrl(league);
    return subscribeSSE(
      url,
      { fetchFallback: () => getLeagueGames(league) },
      ({ data, streamError: e }) => {
        if (data !== undefined) setLiveGames(data);
        if (e !== undefined) setStreamError(e);
      },
    );
  }, [league]);

  return { liveGames, streamError };
}
