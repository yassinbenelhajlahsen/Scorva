import { useState, useEffect } from "react";
import { getGameDates } from "../api/games.js";

export function useGameDates(league, season) {
  const [dates, setDates] = useState([]);
  const [gameCounts, setGameCounts] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setDates([]);
    setGameCounts(new Map());

    getGameDates(league, { season: season || undefined, signal: controller.signal })
      .then((data) => {
        setDates(data.map((d) => d.date));
        setGameCounts(new Map(data.map((d) => [d.date, d.count])));
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Error fetching game dates:", err);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [league, season]);

  return { dates, gameCounts, loading };
}
