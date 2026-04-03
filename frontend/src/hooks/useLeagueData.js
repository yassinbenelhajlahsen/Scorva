import { useState, useEffect, useCallback, useRef } from "react";
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

export function useLeagueData(league, selectedSeason, selectedDate) {
  const [games, setGames] = useState([]);
  const [standings, setStandings] = useState({ eastOrAFC: [], westOrNFC: [] });
  const [loading, setLoading] = useState(true);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [displayData, setDisplayData] = useState(false);
  const [resolvedDate, setResolvedDate] = useState(null);
  const [resolvedSeason, setResolvedSeason] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const prevContextRef = useRef({ league: null, selectedSeason: undefined });

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const isDateOnlyChange =
      prevContextRef.current.league === league &&
      prevContextRef.current.selectedSeason === selectedSeason &&
      prevContextRef.current.league !== null;
    prevContextRef.current = { league, selectedSeason };

    async function fetchData() {
      setLoading(true);
      setError(null);
      setResolvedDate(null);
      setResolvedSeason(null);

      if (isDateOnlyChange) {
        // Keep standings/displayData visible; only show games as loading
        setGamesLoading(true);
        setGames([]);
      } else {
        setDisplayData(false);
        setGamesLoading(false);
      }

      try {
        const raw = await getLeagueGames(league, { season: selectedSeason, date: selectedDate, signal });

        // When date is provided the backend returns { games, resolvedDate }; otherwise a flat array
        if (selectedDate && raw && !Array.isArray(raw)) {
          setGames(raw.games);
          setResolvedDate(raw.resolvedDate);
          setResolvedSeason(raw.resolvedSeason ?? null);
        } else {
          setGames(raw);
          setResolvedDate(null);
          setResolvedSeason(null);
        }

        // Skip standings re-fetch on date-only changes, but always fetch when
        // standings are still empty (covers StrictMode double-invoke where the
        // first run is aborted before setStandings fires).
        if (!isDateOnlyChange || standings.eastOrAFC.length === 0) {
          const teams = await getStandings(league, { season: selectedSeason, signal });
          const isNFL = league === "nfl";
          const east = teams.filter((t) => t.conf?.toLowerCase() === (isNFL ? "afc" : "east"));
          const west = teams.filter((t) => t.conf?.toLowerCase() === (isNFL ? "nfc" : "west"));
          setStandings({ eastOrAFC: east, westOrNFC: west });
        }

        await new Promise((r) => setTimeout(r, 50));
        setDisplayData(true);
        setLoading(false);
        setGamesLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch data:", err);
          setError("Failed to load data.");
          setLoading(false);
          setGamesLoading(false);
        }
      }
    }

    fetchData();
    return () => controller.abort();
  }, [league, selectedSeason, selectedDate, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Activate SSE when viewing today — either the default null view or an explicit today date
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const { liveGames } = useLiveGames(
    selectedSeason === null && (selectedDate === null || selectedDate === todayET) && hasLiveGame(games)
      ? league
      : null
  );

  useEffect(() => {
    if (liveGames) setGames(liveGames);
  }, [liveGames]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { games, standings, loading, gamesLoading, error, displayData, retry, resolvedDate, resolvedSeason };
}
