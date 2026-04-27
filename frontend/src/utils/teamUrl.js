import slugify from "./slugify.js";

export default function teamUrl(league, team) {
  const abbr = (team?.abbreviation || "").toLowerCase();
  const id = abbr || slugify(team?.name || "");
  return `/${league}/teams/${id}`;
}
