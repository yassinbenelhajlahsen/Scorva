const BASE = import.meta.env.VITE_API_URL;

export async function apiFetch(path, { signal, params, token, method = "GET", body, timeout = 15000 } = {}) {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.set(k, v);
    });
  }
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const combinedSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
    : AbortSignal.timeout(timeout);
  const res = await fetch(url, {
    method,
    signal: combinedSignal,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}
