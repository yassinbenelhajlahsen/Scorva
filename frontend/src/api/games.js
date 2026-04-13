import { apiFetch } from "./client.js";

export function getAllLeagueGames(signal) {
  return Promise.all(
    ["nba", "nhl", "nfl"].map((league) =>
      apiFetch(`/api/${league}/games`, { signal })
    )
  ).then(([nba, nhl, nfl]) => ({ nba, nhl, nfl }));
}

export function getLeagueGames(league, { season, date, signal } = {}) {
  return apiFetch(`/api/${league}/games`, { signal, params: { season, date } });
}

export function getGameDates(league, { season, signal } = {}) {
  return apiFetch(`/api/${league}/games/dates`, { signal, params: { season } });
}

export function getTeamGames(league, teamId, { season, signal } = {}) {
  return apiFetch(`/api/${league}/games`, { signal, params: { teamId, season } });
}

export function getGameById(league, gameId, { signal } = {}) {
  return apiFetch(`/api/${league}/games/${gameId}`, { signal });
}

export async function getGamePrediction(league, gameId, { signal } = {}) {
  try {
    return await apiFetch(`/api/${league}/games/${gameId}/prediction`, { signal });
  } catch (err) {
    if (err.message === "HTTP 404") return null;
    throw err;
  }
}

export function getLiveGamesUrl(league) {
  return `${import.meta.env.VITE_API_URL}/api/live/${league}/games`;
}

export function getLiveGameUrl(league, gameId) {
  return `${import.meta.env.VITE_API_URL}/api/live/${league}/games/${gameId}`;
}

export function getWinProbability(league, eventId, { signal, isFinal } = {}) {
  return apiFetch(`/api/${league}/games/${eventId}/win-probability`, {
    signal,
    params: isFinal ? { final: "true" } : undefined,
  });
}
