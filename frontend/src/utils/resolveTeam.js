import slugify from "./slugify.js";

export default function resolveTeam(teamList, param) {
  if (!param) return null;
  const p = String(param).toLowerCase();
  return teamList.find((t) =>
    (t.abbreviation || "").toLowerCase() === p ||
    slugify(t.name) === p ||
    slugify(t.shortname || "") === p
  ) ?? null;
}
