import { useState, useEffect } from "react";
import { getGameById, getLeagueGames, getGameDates, getAllLeagueGames } from "../api/games.js";
import { getPlayer, getDuplicatePlayerSlugs } from "../api/players.js";
import { getTeams } from "../api/teams.js";
import { getNews } from "../api/news.js";
import { getReports } from "../api/reports.js";
import { getHeadToHead } from "../api/compare.js";
import { getTopPerformances } from "../api/topPerformances.js";
import resolveTeam from "../utils/resolveTeam.js";

export const queryKeys = {
  seasons:        (league) => ["seasons", league],
  gameDates:      (league, season) => ["gameDates", league, season],
  similarPlayers: (league, slug, season) => ["similarPlayers", league, slug, season],
  prediction:     (league, gameId) => ["prediction", league, gameId],
  aiSummary:      (gameId) => ["aiSummary", gameId],
  favorites:      () => ["favorites"],
  userPrefs:      () => ["userPrefs"],
  search:         (query) => ["search", query],
  winProbability: (league, eventId, isFinal) => ["winProbability", league, eventId, isFinal],
  plays:          (league, gameId) => ["plays", league, gameId],
  player:         (league, slug, season) => ["player", league, slug, season],
  team:           (league, teamId) => ["team", league, teamId],
  teamGames:      (league, teamId, season) => ["teamGames", league, teamId, season],
  teamSeasons:    (league, teamId) => ["teamSeasons", league, teamId],
  teamRoster:     (league, teamId, season) => ["teamRoster", league, teamId, season],
  standings:      (league, season) => ["standings", league, season],
  streak:         (league, subjectType, subjectId) => ["streak", league, subjectType, subjectId],
  leagueGames:    (league, season, date) => ["leagueGames", league, season, date],
  game:           (league, gameId) => ["game", league, gameId],
  homeGames:      () => ["homeGames"],
  favoriteCheck:  (type, id) => ["favoriteCheck", type, id],
  news:           () => ["news"],
  reports:        (league, type, limit, offset) => ["reports", league ?? "all", type ?? "all", limit ?? 20, offset ?? 0],
  headToHead:     (league, type, ids) => ["headToHead", league, type, ...ids],
  playoffs:       (league, season) => ["playoffs", league, season],
  duplicatePlayerSlugs: (league) => ["duplicatePlayerSlugs", league],
  topPerformances: (league, { type, window, sort, position, limit, playerId, fallback }) =>
    ["top-performances", league, type, window, sort, position, limit, playerId ?? null, fallback ? "fb" : "nofb"],
};

export const queryFns = {
  game: (league, gameId) => () => getGameById(league, gameId),
  player: (league, slug, season) => () =>
    getPlayer(league, slug, { season }).then((d) => d.player),
  team: (league, teamSlug) => () =>
    getTeams(league).then((teamList) => {
      const found = resolveTeam(teamList, teamSlug);
      if (!found) throw new Error("Team not found.");
      return found;
    }),
  leagueGames: (league, season, date) => () =>
    getLeagueGames(league, { season, date }),
  gameDates: (league, season) => () => getGameDates(league, { season }),
  homeGames: () => () => getAllLeagueGames(),
  news: () => () => getNews(),
  reports: (league, type, limit, offset) => ({ signal }) =>
    getReports({ league, type, limit, offset, signal }),
  headToHead: (league, type, ids) => () =>
    getHeadToHead(league, type, ids).then((d) => d.games),
  duplicatePlayerSlugs: (league) => ({ signal }) => getDuplicatePlayerSlugs(league, { signal }),
  topPerformances: (league, opts) =>
    ({ signal }) => getTopPerformances(league, { ...opts, signal }),
};

export function useDebouncedValue(value, delay = 200) {
  // Initialize with "" so TQ doesn't fire immediately on mount
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
