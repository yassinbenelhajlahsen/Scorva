import { useState, useEffect, useCallback } from "react";
import { getLeagueGames } from "../api/games.js";
import { getStandings } from "../api/teams.js";
import { useLiveGames } from "./useLiveGames.js";

function hasLiveGame(games) {
  return games.some(
    (g) =>
      g.status.includes("In Progress") ||
      g.status.includes("End of Period") ||
      g.status.includes("Halftime")
  );
}

export function useLeagueData(league, selectedSeason) {
  const [games, setGames] = useState([]);
  const [standings, setStandings] = useState({ eastOrAFC: [], westOrNFC: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [displayData, setDisplayData] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchData() {
      setLoading(true);
      setDisplayData(false);
      setError(null);

      try {
        const allGames = await getLeagueGames(league, { season: selectedSeason, signal });
        setGames(allGames);

        const teams = await getStandings(league, { season: selectedSeason, signal });

        const isNFL = league === "nfl";
        const east = teams.filter((t) => t.conf?.toLowerCase() === (isNFL ? "afc" : "east"));
        const west = teams.filter((t) => t.conf?.toLowerCase() === (isNFL ? "nfc" : "west"));

        setStandings({ eastOrAFC: east, westOrNFC: west });
        await new Promise((r) => setTimeout(r, 50));
        setDisplayData(true);
        setLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch data:", err);
          setError("Failed to load data.");
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => controller.abort();
  }, [league, selectedSeason, retryCount]);

  const { liveGames } = useLiveGames(selectedSeason === null && hasLiveGame(games) ? league : null);

  useEffect(() => {
    if (liveGames) setGames(liveGames);
  }, [liveGames]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { games, standings, loading, error, displayData, retry };
}
