import { useState, useEffect, useCallback } from "react";
import { getTeams, getStandings } from "../api/teams.js";
import { getTeamGames } from "../api/games.js";
import slugify from "../utilities/slugify.js";

export function useTeam(league, teamId, selectedSeason) {
  const [team, setTeam] = useState(null);
  const [games, setGames] = useState([]);
  const [teamRecord, setTeamRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Phase 1: resolve slug → team
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setTeam(null);

    async function fetchTeam() {
      try {
        const teamList = await getTeams(league, { signal: controller.signal });
        const found = teamList.find(
          (t) => slugify(t.name) === teamId || slugify(t.shortname || "") === teamId
        );
        if (!found) throw new Error("Team not found.");
        setTeam(found);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load data.");
          setLoading(false);
        }
      }
    }

    fetchTeam();
    return () => controller.abort();
  }, [league, teamId, retryCount]);

  // Phase 2: fetch games + standings once team is resolved
  useEffect(() => {
    if (!team) return;

    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchGames() {
      setLoading(true);
      try {
        const [gamesData, standingsData] = await Promise.all([
          getTeamGames(league, team.id, { season: selectedSeason, signal }),
          getStandings(league, { season: selectedSeason, signal }),
        ]);

        const sorted = gamesData.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
        setGames(sorted);

        const standing = standingsData.find((t) => t.id === team.id);
        setTeamRecord(standing ? `${standing.wins}-${standing.losses}` : null);
        setLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load games.");
          setLoading(false);
        }
      }
    }

    fetchGames();
    return () => controller.abort();
  }, [league, team, selectedSeason]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { team, games, teamRecord, loading, error, retry };
}
