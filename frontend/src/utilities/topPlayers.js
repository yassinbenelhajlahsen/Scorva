function parsePlusMinus(pm) {
  if (typeof pm === "number") return pm;
  if (!pm) return 0;
  const sign = pm.startsWith("-") ? -1 : 1;
  return sign * parseInt(pm.replace(/[^\d]/g, ""), 10);
}

function pickBest(players, scorer) {
  return players.reduce((top, p) =>
    !top || scorer(p) > scorer(top) ? p : top
  , null);
}

function pickBestExcluding(players, scorer, exclude) {
  return pickBest(players.filter(p => !exclude.has(p.name)), scorer);
}

const leagueMetrics = {
  nba: {
    // Hollinger Game Score (simplified): weights all-around play, penalizes turnovers.
    // Rebounding and assists are discounted vs points since they're easier to accumulate;
    // steals/blocks carry full weight as they're high-value, low-occurrence plays.
    performanceScore: s =>
      (s.PTS || 0) +
      0.4 * (s.REB || 0) +
      0.7 * (s.AST || 0) +
      1.0 * (s.STL || 0) +
      1.0 * (s.BLK || 0) -
      1.0 * (s.TOV || 0),

    score: s => s.PTS || 0,

    // Two-way impact: on-off differential plus defensive disruption.
    // Combining +/- with defensive stats reduces garbage-time noise —
    // a player who played 3 min with +6 but has 0 STL/BLK won't beat
    // a starter who went +4 with 3 steals.
    impactScore: s =>
      parsePlusMinus(s["+/-"]) +
      (s.STL || 0) * 1.5 +
      (s.BLK || 0),
  },

  nfl: {
    // Position-agnostic composite: QBs earn through YDS + CMP efficiency,
    // skill players through YDS + TDs, defensive players through sacks.
    // INTs penalize QBs and reward defenders in the same formula.
    performanceScore: s =>
      (s.YDS  || 0) * 0.05 +
      (s.CMP  || 0) * 0.3  +
      (s.TD   || 0) * 10   -
      (s.INT  || 0) * 4    +
      (s.SCKS || 0) * 5,

    // Raw touchdown output (most direct scoring contribution)
    score: s => s.TD || 0,

    // Defensive impact: sacks and takeaways with yards as tiebreaker
    // so this slot surfaces the defensive standout, not a third offensive player.
    impactScore: s =>
      (s.SCKS || 0) * 5 +
      (s.INT  || 0) * 6 +
      (s.YDS  || 0) * 0.02,
  },

  nhl: {
    // Goals weighted above assists (scoring is harder); shots and physical
    // play get small credit for sustained offensive/defensive pressure.
    // Saves included so goalies can appear when they carry their team.
    performanceScore: s =>
      (s.G      || 0) * 2.0  +
      (s.A      || 0) * 1.5  +
      (s.SHOTS  || 0) * 0.15 +
      (s.SAVES  || 0) * 0.1  +
      (s.BS     || 0) * 0.4  +
      (s.HT     || 0) * 0.2,

    score: s => s.G || 0,

    // On-ice differential anchors the metric, amplified by point production.
    // +/- alone is noisy in short ice-time; adding G+A rewards players
    // who were both on the right side of the differential AND contributed offensively.
    impactScore: s =>
      parsePlusMinus(s["+/-"]) * 1.5 +
      (s.G || 0) +
      (s.A || 0),
  },
};

export default function computeTopPlayers(_game, stats, league) {
  const players = stats
    .filter(p => p.stats && typeof p.stats === "object")
    .map(p => ({
      name:     p.name,
      position: p.position,
      imageUrl:  p.imageUrl,
      league,
      stats:    p.stats,
    }));

  if (players.length === 0) {
    return { topPerformer: null, topScorer: null, impactPlayer: null };
  }

  const metrics = leagueMetrics[league];
  if (!metrics) {
    throw new Error(`Unsupported league: ${league}`);
  }

  const { performanceScore, score, impactScore } = metrics;

  const topPerformer = pickBest(players, p => performanceScore(p.stats));

  // Deduplicate: if the top scorer is the same player as the top performer,
  // surface the next best scorer so each card highlights a different player.
  const afterPerformer = new Set([topPerformer?.name]);
  const topScorer = pickBestExcluding(players, p => score(p.stats), afterPerformer);

  // Same deduplication for impact — ensure 3 distinct players.
  const afterScorer = new Set([topPerformer?.name, topScorer?.name]);
  const impactPlayer = pickBestExcluding(players, p => impactScore(p.stats), afterScorer);

  return { topPerformer, topScorer, impactPlayer };
}
