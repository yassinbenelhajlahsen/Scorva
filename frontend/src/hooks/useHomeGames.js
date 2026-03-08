import { useState, useEffect, useCallback } from "react";
import { getAllLeagueGames } from "../api/games.js";
import { useLiveGames } from "./useLiveGames.js";

function hasLiveGame(games) {
  return games.some(
    (g) =>
      g.status.includes("In Progress") ||
      g.status.includes("End of Period") ||
      g.status.includes("Halftime")
  );
}

export function useHomeGames() {
  const [games, setGames] = useState({ nba: [], nhl: [], nfl: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAll() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllLeagueGames(controller.signal);
        setGames(data);
        setLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Could not load games. Please try again later.");
          setLoading(false);
        }
      }
    }

    fetchAll();
    return () => controller.abort();
  }, [retryCount]);

  const { liveGames: liveNba } = useLiveGames(hasLiveGame(games.nba) ? "nba" : null);
  const { liveGames: liveNhl } = useLiveGames(hasLiveGame(games.nhl) ? "nhl" : null);
  const { liveGames: liveNfl } = useLiveGames(hasLiveGame(games.nfl) ? "nfl" : null);

  useEffect(() => {
    setGames((prev) => ({
      nba: liveNba ?? prev.nba,
      nhl: liveNhl ?? prev.nhl,
      nfl: liveNfl ?? prev.nfl,
    }));
  }, [liveNba, liveNhl, liveNfl]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { games, loading, error, retry };
}
