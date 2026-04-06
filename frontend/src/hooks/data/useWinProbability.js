import { useState, useEffect, useRef } from "react";
import { getWinProbability } from "../../api/games.js";

const POLL_INTERVAL_MS = 30_000;

export function useWinProbability(league, eventId, { isFinal = false, isLive = false } = {}) {
  const [data, setData] = useState(null);
  const [scoreMargin, setScoreMargin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!league || !eventId) {
      setLoading(false);
      return;
    }

    let intervalId = null;

    async function fetchData() {
      const controller = new AbortController();
      try {
        const resp = await getWinProbability(league, eventId, {
          signal: controller.signal,
          isFinal,
        });
        if (mountedRef.current) {
          const respData = resp?.data;
          if (respData?.winProbability) {
            setData(respData.winProbability);
            setScoreMargin(respData.scoreMargin ?? null);
          } else {
            // backward-compat: legacy flat-array cached responses
            setData(respData ?? null);
            setScoreMargin(null);
          }
          setLoading(false);
          setError(false);
        }
      } catch (err) {
        if (err.name !== "AbortError" && mountedRef.current) {
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchData();

    if (isLive) {
      intervalId = setInterval(fetchData, POLL_INTERVAL_MS);
    }

    return () => {
      clearInterval(intervalId);
    };
  }, [league, eventId, isFinal, isLive]);

  return { data, scoreMargin, loading, error };
}
