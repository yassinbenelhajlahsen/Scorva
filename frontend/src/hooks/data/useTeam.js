import { useState, useEffect, useCallback } from "react";
import { getTeams, getStandings, getTeamSeasons } from "../../api/teams.js";
import { getTeamGames } from "../../api/games.js";
import slugify from "../../utils/slugify.js";

export function useTeam(league, teamId, selectedSeason) {
  const [team, setTeam] = useState(null);
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [games, setGames] = useState([]);
  const [teamRecord, setTeamRecord] = useState(null);
  const [homeRecord, setHomeRecord] = useState(null);
  const [awayRecord, setAwayRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Phase 1: resolve slug → team (full skeleton until resolved)
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setTeam(null);
    setHomeRecord(null);
    setAwayRecord(null);

    async function fetchTeam() {
      try {
        const teamList = await getTeams(league, { signal: controller.signal });
        const found = teamList.find(
          (t) => slugify(t.name) === teamId || slugify(t.shortname || "") === teamId
        );
        if (!found) throw new Error("Team not found.");
        setTeam(found);
        getTeamSeasons(league, found.id, { signal: controller.signal })
          .then(setAvailableSeasons)
          .catch((err) => { if (err.name !== "AbortError") console.error("Error fetching team seasons:", err); });
        setLoading(false);
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

  // Phase 2: fetch games + standings once team is resolved (partial skeleton)
  useEffect(() => {
    if (!team) return;

    const controller = new AbortController();
    const signal = controller.signal;

    async function fetchGames() {
      setSeasonLoading(true);
      try {
        const [gamesData, standingsData] = await Promise.all([
          getTeamGames(league, team.id, { season: selectedSeason, signal }),
          getStandings(league, { season: selectedSeason, signal }),
        ]);

        const sorted = gamesData.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
        setGames(sorted);

        const finalGames = gamesData.filter((g) => /final/i.test(g.status ?? ""));
        const homeGames = finalGames.filter((g) => g.hometeamid === team.id);
        const homeWins = homeGames.filter((g) => g.winnerid === g.hometeamid).length;
        const awayGames = finalGames.filter((g) => g.awayteamid === team.id);
        const awayWins = awayGames.filter((g) => g.winnerid === g.awayteamid).length;
        setHomeRecord(`${homeWins}-${homeGames.length - homeWins}`);
        setAwayRecord(`${awayWins}-${awayGames.length - awayWins}`);

        const standing = standingsData.find((t) => t.id === team.id);
        setTeamRecord(standing ? `${standing.wins}-${standing.losses}` : null);
        setSeasonLoading(false);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Failed to load games.");
          setSeasonLoading(false);
        }
      }
    }

    fetchGames();
    return () => controller.abort();
  }, [league, team, selectedSeason]);

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  return { team, games, availableSeasons, teamRecord, homeRecord, awayRecord, loading, seasonLoading, error, retry };
}
