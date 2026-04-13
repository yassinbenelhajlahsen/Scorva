export function getSportPath(leagueSlug) {
  switch (leagueSlug.toLowerCase()) {
    case "nba":
      return "basketball";
    case "nfl":
      return "football";
    case "nhl":
      return "hockey";
    default:
      throw new Error(`Unsupported league: ${leagueSlug}`);
  }
}
