const CHAMPIONSHIP_TYPES = new Set([
  "champion",
  "finals_mvp",
  "super_bowl_mvp",
  "conn_smythe",
]);

const NBA_MAP = new Map([
  // Core individual awards
  ["mvp", "mvp"],
  ["most valuable player", "mvp"],
  ["finals mvp", "finals_mvp"],
  ["bill russell nba finals mvp", "finals_mvp"],
  ["rookie of the year", "roy"],
  ["defensive player of the year", "dpoy"],
  ["most improved player", "mip"],
  ["sixth man of the year", "sixth_man"],
  ["sixth man award", "sixth_man"],
  ["scoring leader", "scoring_champ"],
  ["scoring champion", "scoring_champ"],
  ["clutch player of the year", "clutch_poy"],
  ["twyman-stokes teammate of the year award", "teammate_of_year"],
  ["teammate of the year", "teammate_of_year"],
  // Team selections — ESPN uses 1st/2nd/3rd, also accept First/Second/Third
  ["all-nba 1st team", "all_nba_first"],
  ["all-nba 2nd team", "all_nba_second"],
  ["all-nba 3rd team", "all_nba_third"],
  ["all-nba first team", "all_nba_first"],
  ["all-nba second team", "all_nba_second"],
  ["all-nba third team", "all_nba_third"],
  ["all-defensive 1st team", "all_defensive_first"],
  ["all-defensive 2nd team", "all_defensive_second"],
  ["all-defensive first team", "all_defensive_first"],
  ["all-defensive second team", "all_defensive_second"],
  ["all-rookie 1st team", "all_rookie_first"],
  ["all-rookie 2nd team", "all_rookie_second"],
  ["all-rookie first team", "all_rookie_first"],
  ["all-rookie second team", "all_rookie_second"],
  // All-Star
  ["all-star", "all_star"],
  ["all-star mvp", "all_star_mvp"],
  // Conference Finals MVP
  ["nba eastern conference finals mvp", "east_finals_mvp"],
  ["nba western conference finals mvp", "west_finals_mvp"],
  ["eastern conference finals mvp", "east_finals_mvp"],
  ["western conference finals mvp", "west_finals_mvp"],
  // NBA Cup / In-Season Tournament
  ["nba cup mvp", "cup_mvp"],
  ["in-season tournament mvp", "cup_mvp"],
  ["nba cup all-tournament team", "cup_all_tournament"],
  ["in-season tournament all-tournament team", "cup_all_tournament"],
  // Championship
  ["nba champion", "champion"],
  ["champion", "champion"],
]);

const NFL_MAP = new Map([
  ["mvp", "mvp"],
  ["most valuable player", "mvp"],
  ["associated press nfl most valuable player", "mvp"],
  ["super bowl mvp", "super_bowl_mvp"],
  ["super bowl champion", "champion"],
  ["pro bowl", "pro_bowl"],
  ["pro bowl selection", "pro_bowl"],
  // ESPN may use 1st/2nd or First/Second
  ["all-pro 1st team", "all_pro_first"],
  ["all-pro 2nd team", "all_pro_second"],
  ["all-pro first team", "all_pro_first"],
  ["all-pro second team", "all_pro_second"],
  ["associated press first-team all-pro", "all_pro_first"],
  ["associated press second-team all-pro", "all_pro_second"],
  // Player awards
  ["offensive player of the year", "opoy"],
  ["defensive player of the year", "dpoy"],
  ["offensive rookie of the year", "oroy"],
  ["defensive rookie of the year", "droy"],
  ["comeback player of the year", "comeback_poy"],
  ["walter payton man of the year", "walter_payton"],
  ["walter payton nfl man of the year", "walter_payton"],
]);

const NHL_MAP = new Map([
  // Core
  ["hart trophy", "mvp"],
  ["hart memorial trophy", "mvp"],
  ["conn smythe trophy", "conn_smythe"],
  ["stanley cup champion", "champion"],
  ["stanley cup", "champion"],
  ["calder trophy", "calder"],
  ["calder memorial trophy", "calder"],
  // All-Star
  ["all-star", "all_star"],
  ["all-star game", "all_star"],
  ["all-star mvp", "all_star_mvp"],
  ["1st all-star team", "nhl_all_star_first"],
  ["2nd all-star team", "nhl_all_star_second"],
  ["first all-star team", "nhl_all_star_first"],
  ["second all-star team", "nhl_all_star_second"],
  // Other player trophies
  ["art ross trophy", "art_ross"],
  ["maurice richard trophy", "richard"],
  ["william jennings trophy", "jennings"],
  ["norris trophy", "norris"],
  ["james norris memorial trophy", "norris"],
  ["vezina trophy", "vezina"],
  ["selke trophy", "selke"],
  ["frank j. selke trophy", "selke"],
  ["lady byng trophy", "lady_byng"],
  ["lady byng memorial trophy", "lady_byng"],
  ["ted lindsay award", "ted_lindsay"],
  ["mark messier nhl leadership award", "messier_leadership"],
  ["mark messier leadership award", "messier_leadership"],
  ["bill masterton memorial trophy", "masterton"],
  ["king clancy memorial trophy", "king_clancy"],
]);

const LEAGUE_MAPS = {
  nba: NBA_MAP,
  nfl: NFL_MAP,
  nhl: NHL_MAP,
};

const DISPLAY_LABEL = {
  // Universal
  mvp: "MVP",
  champion: "Champion",
  all_star: "All-Star",
  all_star_mvp: "All-Star MVP",
  // NBA
  finals_mvp: "Finals MVP",
  east_finals_mvp: "ECF MVP",
  west_finals_mvp: "WCF MVP",
  roy: "Rookie of the Year",
  dpoy: "Defensive POY",
  mip: "Most Improved",
  sixth_man: "Sixth Man",
  scoring_champ: "Scoring Leader",
  clutch_poy: "Clutch POY",
  teammate_of_year: "Teammate of the Year",
  all_nba_first: "All-NBA 1st",
  all_nba_second: "All-NBA 2nd",
  all_nba_third: "All-NBA 3rd",
  all_defensive_first: "All-Defensive 1st",
  all_defensive_second: "All-Defensive 2nd",
  all_rookie_first: "All-Rookie 1st",
  all_rookie_second: "All-Rookie 2nd",
  cup_mvp: "Cup MVP",
  cup_all_tournament: "Cup All-Tournament",
  // NFL
  super_bowl_mvp: "Super Bowl MVP",
  all_pro_first: "All-Pro 1st",
  all_pro_second: "All-Pro 2nd",
  pro_bowl: "Pro Bowl",
  opoy: "Offensive POY",
  oroy: "Offensive ROY",
  droy: "Defensive ROY",
  comeback_poy: "Comeback POY",
  walter_payton: "Walter Payton Award",
  // NHL
  conn_smythe: "Conn Smythe",
  calder: "Calder",
  nhl_all_star_first: "1st All-Star Team",
  nhl_all_star_second: "2nd All-Star Team",
  art_ross: "Art Ross",
  richard: "Maurice Richard",
  jennings: "Jennings",
  norris: "Norris",
  vezina: "Vezina",
  selke: "Selke",
  lady_byng: "Lady Byng",
  ted_lindsay: "Ted Lindsay",
  messier_leadership: "Messier Leadership",
  masterton: "Masterton",
  king_clancy: "King Clancy",
};

// Awards that ESPN exposes but are NOT awarded to a single player (coach, executive,
// franchise-level, etc.). Silently skipped without a warning.
const OUT_OF_SCOPE = {
  nba: new Set([
    "coach of the year",
    "executive of the year",
    "social justice champion",
  ]),
  nfl: new Set([
    "coach of the year",
  ]),
  nhl: new Set([
    "jack adams award",
  ]),
};

// ESPN sometimes prefixes award names with the league (e.g. "NFL MVP", "NBA Champion").
// Strip a leading league token so lookups don't need duplicate keys per variant.
function normalizeName(league, espnName) {
  const trimmed = espnName.trim().toLowerCase();
  const prefix = `${league?.toLowerCase()} `;
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
}

export function mapEspnAward(league, espnName) {
  if (!espnName) return null;
  const map = LEAGUE_MAPS[league?.toLowerCase()];
  if (!map) return null;
  const raw = espnName.trim().toLowerCase();
  const stripped = normalizeName(league, espnName);
  const awardType = map.get(stripped) ?? map.get(raw);
  if (!awardType) return null;
  return {
    awardType,
    tier: CHAMPIONSHIP_TYPES.has(awardType) ? "championship" : "standard",
  };
}

export function isKnownOutOfScope(league, espnName) {
  if (!espnName) return false;
  const set = OUT_OF_SCOPE[league?.toLowerCase()];
  if (!set) return false;
  const raw = espnName.trim().toLowerCase();
  const stripped = normalizeName(league, espnName);
  return set.has(stripped) || set.has(raw);
}

export function displayLabel(awardType) {
  return DISPLAY_LABEL[awardType] ?? awardType;
}

export const KNOWN_AWARD_TYPES = Object.keys(DISPLAY_LABEL);
