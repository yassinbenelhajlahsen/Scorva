import { useState, useEffect, useRef } from "react";
import { getLiveGameUrl, getGameById } from "../../api/games.js";
import { useVisibilityReconnect } from "./useVisibilityReconnect.js";

const MAX_FAILURES = 3;
const POLL_INTERVAL_MS = 30_000;

export function useLiveGame(league, gameId, enabled) {
  const [liveData, setLiveData] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);

  const esRef = useRef(null);
  const pollRef = useRef(null);
  const failureCount = useRef(0);
  const pendingRef = useRef(null);
  const throttleRef = useRef(null);

  // On tab return, force a reconnect — mobile PWAs and desktop sleep often
  // leave the EventSource silently dead even though readyState reports OPEN.
  useVisibilityReconnect(() => {
    if (!enabled || !league || !gameId) return;
    setReconnectKey((k) => k + 1);
  }, !!enabled && !!league && !!gameId);

  useEffect(() => {
    if (!enabled || !league || !gameId) return;

    function startPollingFallback() {
      setConnectionError(true);
      setIsStreaming(false);
      pollRef.current = setInterval(async () => {
        try {
          const data = await getGameById(league, gameId);
          setLiveData(data);
        } catch {
          // silently continue
        }
      }, POLL_INTERVAL_MS);
    }

    function cleanup() {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      clearInterval(pollRef.current);
      pollRef.current = null;
      clearTimeout(throttleRef.current);
      throttleRef.current = null;
    }

    const es = new EventSource(getLiveGameUrl(league, gameId));
    esRef.current = es;
    failureCount.current = 0;
    setIsStreaming(true);

    es.onmessage = (event) => {
      failureCount.current = 0;
      try {
        pendingRef.current = JSON.parse(event.data);
        if (!throttleRef.current) {
          throttleRef.current = setTimeout(() => {
            if (pendingRef.current) {
              setLiveData(pendingRef.current);
              pendingRef.current = null;
            }
            throttleRef.current = null;
          }, 1000);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.addEventListener("done", () => {
      cleanup();
      setIsStreaming(false);
    });

    es.onerror = () => {
      failureCount.current += 1;
      if (failureCount.current >= MAX_FAILURES) {
        cleanup();
        startPollingFallback();
      }
    };

    return cleanup;
  }, [league, gameId, enabled, reconnectKey]);

  return { liveData, isStreaming, connectionError };
}
