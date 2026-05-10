import { useState, useEffect } from "react";
import { getLiveGameUrl, getGameById } from "../../api/games.js";
import { useVisibilityReconnect } from "./useVisibilityReconnect.js";
import { subscribeSSE, forceReconnect } from "./sharedSSE.js";

export function useLiveGame(league, gameId, enabled) {
  const [liveData, setLiveData] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  // On tab return, force a reconnect — mobile PWAs and desktop sleep often
  // leave the EventSource silently dead even though readyState reports OPEN.
  useVisibilityReconnect(() => {
    if (enabled && league && gameId) {
      forceReconnect(getLiveGameUrl(league, gameId));
    }
  }, !!enabled && !!league && !!gameId);

  useEffect(() => {
    if (!enabled || !league || !gameId) return undefined;
    const url = getLiveGameUrl(league, gameId);
    return subscribeSSE(
      url,
      { fetchFallback: () => getGameById(league, gameId) },
      ({ data, streamError: e, isStreaming: s }) => {
        if (data !== undefined) setLiveData(data);
        if (e !== undefined) setConnectionError(e);
        if (s !== undefined) setIsStreaming(s);
      },
    );
  }, [league, gameId, enabled]);

  return { liveData, isStreaming, connectionError };
}
