const OT_STATUSES = ["Final/OT", "Final/SO"];

function isPlayIn(game) {
  return (game.game_label || "").toLowerCase().includes("play-in");
}

function isCountableFinal(game) {
  if (!/final/i.test(game.status ?? "")) return false;
  if (game.type !== "regular" && game.type !== "makeup") return false;
  if (isPlayIn(game)) return false;
  return true;
}

export function recordFromGames(games, teamId, league, { side = "all", limit } = {}) {
  if (!Array.isArray(games) || !teamId) return { wins: 0, losses: 0, otl: 0, n: 0 };
  const isNHL = league === "nhl";

  let filtered = games.filter((g) => {
    if (!isCountableFinal(g)) return false;
    if (side === "home") return g.hometeamid === teamId;
    if (side === "away") return g.awayteamid === teamId;
    return g.hometeamid === teamId || g.awayteamid === teamId;
  });

  if (limit) {
    filtered = filtered
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  let wins = 0;
  let losses = 0;
  let otl = 0;
  for (const g of filtered) {
    if (g.winnerid === teamId) {
      wins += 1;
    } else if (g.winnerid != null) {
      losses += 1;
      if (isNHL && OT_STATUSES.includes(g.status)) otl += 1;
    }
  }

  return { wins, losses, otl, n: filtered.length };
}

export function formatRecord(record, league) {
  if (!record || record.n === 0) return null;
  if (league === "nhl") {
    return `${record.wins}-${record.losses - record.otl}-${record.otl}`;
  }
  return `${record.wins}-${record.losses}`;
}
