import getLeague  from "./getLeagueFromTeam";

function parsePlusMinus(pm) {
  if (typeof pm === "number") return pm;
  if (!pm) return 0;
  const sign = pm.startsWith("-") ? -1 : 1;
  return sign * parseInt(pm.replace(/[^\d]/g, ""), 10);
}

export default function computeTopPlayers(game, stats) {
  const allPlayers = stats.flatMap((p) => {
    const stat = p.recentGames?.find((g) => g.id === game.id);
    if (!stat) return [];
    return {
      name: p.name,
      position: p.position,
      image: p.image || "/defaultPlayer.png",
      league: getLeague(p.team), 
      stats: stat
    };
  });

  const valid = allPlayers.filter(p => p && p.stats);

  // Top Performer: sum core metrics
  const getPerformanceScore = (s) =>
    (s.points || 0) + (s.rebounds || 0) + (s.assists || 0) + (s.steals || 0) + (s.blocks || 0);

  const topPerformer = [...valid].sort((a, b) =>
    getPerformanceScore(b.stats) - getPerformanceScore(a.stats)
  )[0];

  // Top Scorer
  const topScorer = [...valid].sort((a, b) =>
    (b.stats.points || 0) - (a.stats.points || 0)
  )[0];

  // Impact Player: highest plus-minus
  const topImpact = [...valid].sort((a, b) =>
    parsePlusMinus(b.stats.plusMinus) - parsePlusMinus(a.stats.plusMinus)
  )[0];

  return { topPerformer, topScorer, impactPlayer: topImpact };
}
