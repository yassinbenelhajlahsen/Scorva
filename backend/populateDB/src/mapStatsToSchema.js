import commonMappings from "./commonMappings.js";
export default function mapStatsToSchema(statsObj, leagueSlug) {
  const mappedStats = {};

  // League-specific mappings
  const leagueMappings = {
    nba: {
      fg: ["fgPct", "fieldGoalPercentage", "FG", "fieldGoalsMade-fieldGoalsAttempted"],
      threept: ["threePointFieldGoalsMade", "3FGM", "3PT"],
      ft: ["freeThrowPercentage", "FT"],
    },
    nfl: {
      cmpatt: ["Completions/Attempts", "C/ATT"],
      yds: ["yds", "Yards", "YDS"],
      sacks: ["sacks", "sack", "SACKS"],
      td: ["td", "Touchdowns", "TD"],
      interceptions: ["Interceptions", "int", "INT"],
    },
    nhl: {
      g:           ["g", "goals"],
      a:           ["a", "assists"],
      plusminus:  ["plusMinus", "+/-"],
      saves:       ["saves", "SV"],
      ga: ["goalsAgainst", "GA"],
      savePct:    ["save_pct", "savePct"],
      toi:         ["toi", "timeOnIce"],
      shots:       ["shotsTotal", "sog"],
      sm:          ["sm", "shotsMissed"],
      bs:          ["bs", "blockedShots"],
      pn:          ["pn", "penalties"],
      pim:         ["pim", "penaltyMinutes"],
      ht:          ["ht", "hits"],
      tk:          ["tk", "takeaways"],
      gv:          ["gv", "giveaways"],
    },
  };
  // Process common mappings
  Object.entries(commonMappings).forEach(([dbCol, espnNames]) => {
    espnNames.forEach((espnName) => {
      if (statsObj[espnName] !== undefined) {
        mappedStats[dbCol] = statsObj[espnName];
      }
    });
  });

  // Process league-specific mappings
  if (leagueSlug && leagueMappings[leagueSlug]) {
    Object.entries(leagueMappings[leagueSlug]).forEach(([dbCol, espnNames]) => {
      espnNames.forEach((espnName) => {
        if (statsObj[espnName] !== undefined) {
          mappedStats[dbCol] = statsObj[espnName];
        }
      });
    });
  }



  return mappedStats;
}
