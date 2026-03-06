import { apiFetch } from "./client.js";

export function getSeasons(league, { signal } = {}) {
  return apiFetch(`/api/${league}/seasons`, { signal });
}
