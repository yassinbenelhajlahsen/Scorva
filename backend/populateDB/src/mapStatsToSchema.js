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
      cmp: ["cmp", "completions"],
      att: ["att", "attempts"],
      yds: ["yds", "yards"],
      cmp_pct: ["cmp_pct", "completion_percentage"],
      sacks: ["sacks", "sack"],
      td: ["td", "touchdowns"],
      interceptions: ["interceptions", "int"],
    },
    nhl: {
      g: ["g", "goals"],
      a: ["a", "assists"],
      pts: ["pts", "points"],
      plus_minus: ["plus_minus", "+/-"],
      saves: ["saves", "sv"],
      save_pct: ["save_pct", "save_percentage"],
      gaa: ["gaa", "goals_against_average"],
      toi: ["toi", "time_on_ice"],
      shots: ["shots", "sog"],
      sm: ["sm", "shots_missed"],
      bs: ["bs", "blocked_shots"],
      pn: ["pn", "penalties"],
      pim: ["pim", "penalty_minutes"],
      ht: ["ht", "hits"],
      tk: ["tk", "takeaways"],
      gv: ["gv", "giveaways"],
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

  // Special handling for percentage stats (convert from string "50.0" to float 50.0)
  const percentageFields = ["cmp_pct", "save_pct", "fg_pct"];
  percentageFields.forEach((field) => {
    if (mappedStats[field] && typeof mappedStats[field] === "string") {
      mappedStats[field] = parseFloat(mappedStats[field]);
    }
  });

  // Special handling for time formats (convert "15:30" to minutes as integer)
  if (mappedStats.minutes && typeof mappedStats.minutes === "string") {
    const [mins, secs] = mappedStats.minutes.split(":").map(Number);
    mappedStats.minutes = mins + (secs ? Math.round(secs / 60) : 0);
  }

  return mappedStats;
}
