export const PLAYER_TIER = {
  nba: ["triple-double", "30+ point", "double-double", "20+ point", "10+ assist", "10+ rebound"],
  nfl: ["250+ pass yard", "100+ yard", "2+ pass TD", "2+ TD"],
  nhl: ["multi-point", "goal"],
};

function escapeLabel(s) {
  return String(s).replace(/'/g, "''");
}

export function tierCaseSql(labels, columnExpr) {
  const whens = labels
    .map((label, i) => `WHEN '${escapeLabel(label)}' THEN ${i}`)
    .join(" ");
  return `CASE ${columnExpr} ${whens} ELSE 99 END`;
}
