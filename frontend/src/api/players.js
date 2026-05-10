import { apiFetch } from "./client.js";

export function getPlayer(league, slug, { season, signal } = {}) {
  return apiFetch(`/api/${league}/players/${slug}`, { signal, params: { season } });
}

export function getSimilarPlayers(league, slug, { season, signal } = {}) {
  return apiFetch(`/api/${league}/players/${slug}/similar`, { signal, params: { season } });
}

export function getDuplicatePlayerSlugs(league, { signal } = {}) {
  return apiFetch(`/api/${league}/players/duplicate-slugs`, { signal });
}

export function getPlayerRankings(league, slug, { signal } = {}) {
  return apiFetch(`/api/${league}/players/${slug}/rankings`, { signal });
}
