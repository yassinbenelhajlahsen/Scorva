import slugify from "./slugify.js";

export function playerSlug(player, dupeMap) {
  const slug = slugify(player.name);
  const canonicalId = dupeMap?.[slug];
  if (canonicalId === undefined || player.id === undefined) return slug;
  return Number(player.id) === Number(canonicalId) ? slug : `${slug}-${player.id}`;
}

export default function playerUrl(league, player, dupeMap) {
  return `/${league}/players/${playerSlug(player, dupeMap)}`;
}
