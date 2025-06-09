function parsePlusMinus(pm) {
  if (typeof pm === "number") return pm;
  if (!pm) return 0;
  const sign = pm.startsWith("-") ? -1 : 1;
  return sign * parseInt(pm.replace(/[^\d]/g, ""), 10);
}

const leagueMetrics = {
  nba: {
    performanceScore: s =>
      (s.PTS || 0) +
      (s.REB || 0) +
      (s.AST || 0) +
      (s.STL || 0) +
      (s.BLK || 0),
    score: s => s.PTS || 0
  },
  nfl: {
    performanceScore: s =>
      (s.CMP || 0) +
      (s.ATT || 0) +
      (s.YDS || 0) +
      ((s.TD || 0) * 6),
    score: s => (s.TD || 0) * 6
  },
  nhl: {
    performanceScore: s =>
      (s.G || 0) +
      (s.A || 0) +
      (s.SHOTS || 0),
    score: s => s.G || 0
  }
};

export default function computeTopPlayers(game, stats ,league) {
  const playersInGame = stats
    .filter(p => p.stats && typeof p.stats === "object")
    .map(p => {
      return {
        name:     p.name,
        position: p.position,
        imageUrl:    p.imageUrl,
        league,
        stats:    p.stats
      };
    });

  if (playersInGame.length === 0) {
    return { topPerformer: null, topScorer: null, impactPlayer: null };
  }

  const { league: firstLeague } = playersInGame[0];
  const metrics = leagueMetrics[firstLeague];
  if (!metrics) {
    throw new Error(`Unsupported league: ${firstLeague}`);
  }

  const impactScore = p => parsePlusMinus(p.stats["+/-"]);

  const topPerformer = playersInGame.reduce((best, p) =>
    !best || metrics.performanceScore(p.stats) > metrics.performanceScore(best.stats)
      ? p
      : best
  , null);

  const topScorer = playersInGame.reduce((best, p) =>
    !best || metrics.score(p.stats) > metrics.score(best.stats)
      ? p
      : best
  , null);

  const impactPlayer = playersInGame.reduce((best, p) =>
    !best || impactScore(p) > impactScore(best)
      ? p
      : best
  , null);

  return { topPerformer, topScorer, impactPlayer };
}
