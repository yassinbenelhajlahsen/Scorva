// Career-defining awards. Visually treated as the trophy case "centerpieces."
const LEGENDARY = new Set([
  "mvp",
  "champion",
  "finals_mvp",
  "super_bowl_mvp",
  "conn_smythe",
]);

// Best-at-position / best-at-role awards plus first-team selections.
const MAJOR = new Set([
  "dpoy", "opoy", "norris", "vezina",
  "roy", "calder", "oroy", "droy",
  "mip", "sixth_man", "selke", "comeback_poy",
  "all_nba_first", "all_pro_first", "nhl_all_star_first",
  "scoring_champ", "art_ross", "richard",
  "jennings", "ted_lindsay",
  "lady_byng", "clutch_poy",
  "cup_mvp", "east_finals_mvp", "west_finals_mvp",
]);

// Lower number renders first within a tier.
const PRIORITY = {
  // Legendary (most prestigious first)
  mvp: 0,
  champion: 1,
  finals_mvp: 2,
  super_bowl_mvp: 2,
  conn_smythe: 2,

  // Major
  dpoy: 10, opoy: 10, norris: 10, vezina: 10,
  roy: 11, calder: 11, oroy: 11, droy: 11,
  mip: 12, sixth_man: 12, selke: 12, comeback_poy: 12,
  all_nba_first: 13, all_pro_first: 13, nhl_all_star_first: 13,
  scoring_champ: 14, art_ross: 14, richard: 14,
  jennings: 15, ted_lindsay: 15,
  lady_byng: 16, clutch_poy: 16,
  cup_mvp: 17, east_finals_mvp: 17, west_finals_mvp: 17,

  // Selection — second-team first, then game selections, then niche
  all_nba_second: 20, all_pro_second: 20, nhl_all_star_second: 20,
  all_nba_third: 21,
  all_defensive_first: 22,
  all_defensive_second: 23,
  all_rookie_first: 24,
  all_rookie_second: 25,
  all_star: 30,
  pro_bowl: 30,
  all_star_mvp: 31,
  cup_all_tournament: 40,
  walter_payton: 41,
  teammate_of_year: 41,
  masterton: 42,
  messier_leadership: 42,
  king_clancy: 43,
};

export function tierFor(awardType) {
  if (LEGENDARY.has(awardType)) return "legendary";
  if (MAJOR.has(awardType)) return "major";
  return "selection";
}

export function priorityFor(awardType) {
  return PRIORITY[awardType] ?? 99;
}

export function groupAwards(awards) {
  const groups = { legendary: [], major: [], selection: [] };
  for (const a of awards ?? []) {
    groups[tierFor(a.type)].push(a);
  }
  for (const tier of Object.keys(groups)) {
    groups[tier].sort((a, b) => {
      const pa = priorityFor(a.type);
      const pb = priorityFor(b.type);
      if (pa !== pb) return pa - pb;
      return b.count - a.count;
    });
  }
  return groups;
}
