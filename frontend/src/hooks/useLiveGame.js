import { useState, useEffect, useRef } from "react";
import { getLiveGameUrl, getGameById } from "../api/games.js";

const MAX_FAILURES = 3;
const POLL_INTERVAL_MS = 30_000;

export function useLiveGame(league, gameId, isLive) {
  const [liveData, setLiveData] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  const esRef = useRef(null);
  const pollRef = useRef(null);
  const failureCount = useRef(0);

  useEffect(() => {
    if (!isLive || !league || !gameId) return;

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
    }

    const es = new EventSource(getLiveGameUrl(league, gameId));
    esRef.current = es;
    failureCount.current = 0;
    setIsStreaming(true);

    es.onmessage = (event) => {
      failureCount.current = 0;
      try {
        setLiveData(JSON.parse(event.data));
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
  }, [league, gameId, isLive]);

  return { liveData, isStreaming, connectionError };
}
