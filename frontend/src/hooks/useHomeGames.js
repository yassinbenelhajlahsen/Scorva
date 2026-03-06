import { useState, useEffect } from "react";
import { getAllLeagueGames } from "../api/games.js";

export function useHomeGames() {
  const [games, setGames] = useState({ nba: [], nhl: [], nfl: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  }, []);

  return { games, loading, error };
}
