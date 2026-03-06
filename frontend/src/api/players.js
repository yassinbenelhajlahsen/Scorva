import { apiFetch } from "./client.js";

export function getPlayer(league, slug, { season, signal } = {}) {
  return apiFetch(`/api/${league}/players/${slug}`, { signal, params: { season } });
}
