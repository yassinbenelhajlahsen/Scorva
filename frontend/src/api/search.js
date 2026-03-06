import { apiFetch } from "./client.js";

export function search(term, { signal } = {}) {
  return apiFetch("/api/search", { signal, params: { term } });
}
