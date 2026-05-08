import { apiFetch } from "./client.js";

export function getTopPerformances(league, { days = 7, type = "games", limit = 5, signal } = {}) {
  return apiFetch(`/api/${league}/top-performances`, {
    signal,
    params: { days, type, limit },
  });
}
