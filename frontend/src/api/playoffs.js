import { apiFetch } from "./client.js";

export function getPlayoffs(league, { season, signal } = {}) {
  return apiFetch(`/api/${league}/playoffs`, { signal, params: { season } });
}
