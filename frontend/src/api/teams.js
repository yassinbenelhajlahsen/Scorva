import { apiFetch } from "./client.js";

export function getTeams(league, { signal } = {}) {
  return apiFetch(`/api/${league}/teams`, { signal });
}

export function getStandings(league, { season, signal } = {}) {
  return apiFetch(`/api/${league}/standings`, { signal, params: { season } });
}
