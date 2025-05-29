import getLeague  from "./getLeagueFromTeam";

function parsePlusMinus(pm) {
  if (typeof pm === "number") return pm;
  if (!pm) return 0;
  const sign = pm.startsWith("-") ? -1 : 1;
  return sign * parseInt(pm.replace(/[^\d]/g, ""), 10);
}

// define how we score performance & scoring for each league
const leagueMetrics = {
  nba: {
    // a rough “all-around” stat line
    performanceScore: s =>
      (s.points   || 0) +
      (s.rebounds || 0) +
      (s.assists  || 0) +
      (s.steals   || 0) +
      (s.blocks   || 0),
    // pure scoring
    score: s => s.points || 0
  },
  nfl: {
    // passing & rushing volume + touchdown weight
    performanceScore: s =>
      (s.CMP       || 0) +  // completions
      (s.ATT       || 0) +  // attempts
      (s.YDS       || 0) +  // yards
      ((s.TD        || 0) * 6),
    // points produced by touchdowns
    score: s => (s.TD || 0) * 6
  },
  nhl: {
    // basic puck-handling and chance creation
    performanceScore: s =>
      (s.goals    || 0) +
      (s.assists  || 0) +
      (s.shots    || 0),
    // pure goal scoring
    score: s => s.goals || 0
  }
};

export default function computeTopPlayers(game, stats) {
  // build a flat list of only those players who have stats for this game
  const playersInGame = stats.flatMap(p => {
    const stat = p.recentGames?.find(g => g.id === game.id);
    if (!stat) return [];
    const league = getLeague(p.team).toLowerCase();
    return [{
      name:     p.name,
      position: p.position,
      image:    p.image || "/defaultPlayer.png",
      league,
      stats:    stat
    }];
  });

  if (playersInGame.length === 0) {
    return { topPerformer: null, topScorer: null, impactPlayer: null };
  }

  // grab the right metrics for this league (all players will share it)
  const { league: firstLeague } = playersInGame[0];
  const metrics = leagueMetrics[firstLeague];
  if (!metrics) {
    throw new Error(`Unsupported league: ${firstLeague}`);
  }

  const impactScore = p => parsePlusMinus(p.stats.plusMinus);

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
