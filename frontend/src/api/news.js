import { apiFetch } from "./client.js";

export function getNews({ limit = 4, signal } = {}) {
  return apiFetch("/api/news", { signal, params: { limit } });
}
