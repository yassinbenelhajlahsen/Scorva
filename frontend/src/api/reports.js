import { apiFetch } from "./client.js";

export function getReports({ league, type, limit, offset, signal } = {}) {
  const params = {};
  if (league) params.league = league;
  if (type) params.type = type;
  if (limit != null) params.limit = limit;
  if (offset != null) params.offset = offset;
  return apiFetch("/api/reports", { signal, params });
}
