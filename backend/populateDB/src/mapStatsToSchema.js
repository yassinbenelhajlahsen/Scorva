import commonMappings from "./commonMappings.js";
export default function mapStatsToSchema(statsObj, leagueSlug) {
  const mappedStats = {};

  // League-specific mappings
  const leagueMappings = {
    nba: {
      fg: ["fgPct", "fieldGoalPercentage", "FG"],
      threept: ["threePointFieldGoalsMade", "3FGM", "3PT"],
      ft: ["freeThrowPercentage", "FT"],
    },
    nfl: {
      cmpatt: ["Completions/Attempts"],
      yds: ["yds", "Yards"],
      sacks: ["sacks", "sack", "Sacks"],
      td: ["td", "Touchdowns"],
      interceptions: ["Interceptions", "int"],
    },
    nhl: {
      g:           ["g", "goals"],
      a:           ["a", "assists"],
      pts:         ["pts", "points"],
      plus_minus:  ["plusMinus", "+/-"],
      saves:       ["saves", "SV"],
      save_pct:    ["save_pct", "save_percentage"],
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
