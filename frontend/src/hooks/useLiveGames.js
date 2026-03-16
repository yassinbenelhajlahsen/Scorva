import { useState, useEffect, useRef } from "react";
import { getLiveGamesUrl, getLeagueGames } from "../api/games.js";

const MAX_FAILURES = 3;
const POLL_INTERVAL_MS = 30_000;

export function useLiveGames(league) {
  const [liveGames, setLiveGames] = useState(null);
  const [streamError, setStreamError] = useState(false);

  const esRef = useRef(null);
  const pollRef = useRef(null);
  const failureCount = useRef(0);
  const pendingRef = useRef(null);
  const throttleRef = useRef(null);

  useEffect(() => {
    if (!league) return;

    function startPollingFallback() {
      setStreamError(true);
      pollRef.current = setInterval(async () => {
        try {
          const games = await getLeagueGames(league);
          setLiveGames(games);
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

    const es = new EventSource(getLiveGamesUrl(league));
    esRef.current = es;
    failureCount.current = 0;

    es.onmessage = (event) => {
      failureCount.current = 0;
      try {
        pendingRef.current = JSON.parse(event.data);
        if (!throttleRef.current) {
          throttleRef.current = setTimeout(() => {
            if (pendingRef.current) {
              setLiveGames(pendingRef.current);
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
    });

    es.onerror = () => {
      failureCount.current += 1;
      if (failureCount.current >= MAX_FAILURES) {
        cleanup();
        startPollingFallback();
      }
    };

    return cleanup;
  }, [league]);

  return { liveGames, streamError };
}
