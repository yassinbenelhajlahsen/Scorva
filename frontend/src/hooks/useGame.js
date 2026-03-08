import { useState, useEffect, useCallback } from "react";
import { getGameById } from "../api/games.js";
import { useLiveGame } from "./useLiveGame.js";

function isLiveStatus(status) {
  return (
    typeof status === "string" &&
    (status.includes("In Progress") ||
      status.includes("End of Period") ||
      status.includes("Halftime"))
  );
}

export function useGame(league, gameId) {
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchGame() {
      setLoading(true);
      setError(false);
      try {
        const data = await getGameById(league, gameId, { signal: controller.signal });
        setGameData(data);
        setLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error fetching game:", err);
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchGame();
    return () => controller.abort();
  }, [league, gameId, retryCount]);

  const gameStatus = gameData?.json_build_object?.game?.status;
  const isLive = isLiveStatus(gameStatus);
  const { liveData } = useLiveGame(league, gameId, isLive);

  useEffect(() => {
    if (liveData) setGameData(liveData);
  }, [liveData]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { gameData, loading, error, retry };
}
