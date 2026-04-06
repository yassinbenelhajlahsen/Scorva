import { useState, useEffect, useCallback, useRef } from "react";
import { getGamePlays } from "../../api/plays.js";

export function usePlays(league, gameId, isLive) {
  const [plays, setPlays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPlays() {
      setLoading(true);
      setError(false);
      try {
        const data = await getGamePlays(league, gameId, { signal: controller.signal });
        setPlays(data);
        setLoading(false);
      } catch (err) {
        if (err.name === "AbortError") return;
        if (err.message === "HTTP 404") {
          setPlays({ plays: [] });
          setLoading(false);
        } else {
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchPlays();

    if (isLive) {
      intervalRef.current = setInterval(fetchPlays, 30000);
    }

    return () => {
      controller.abort();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [league, gameId, isLive, retryCount]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { plays, loading, error, retry };
}
