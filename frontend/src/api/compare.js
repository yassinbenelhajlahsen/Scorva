import { apiFetch } from "./client.js";

export function getHeadToHead(league, type, ids, { signal } = {}) {
  return apiFetch(`/api/${league}/head-to-head`, {
    signal,
    params: { type, ids: ids.join(",") },
  });
}
