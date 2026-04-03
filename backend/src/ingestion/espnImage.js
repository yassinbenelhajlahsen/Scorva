export function espnImage(url, width, height) {
  if (!url || !url.includes("a.espncdn.com/i/")) return url;
  const path = url.replace(/^https?:\/\/a\.espncdn\.com/, "");
  return `https://a.espncdn.com/combiner/i?img=${path}&w=${width}&h=${height}`;
}
