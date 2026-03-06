const BASE = import.meta.env.VITE_API_URL;

export async function apiFetch(path, { signal, params, token } = {}) {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.set(k, v);
    });
  }
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(url, { signal, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
