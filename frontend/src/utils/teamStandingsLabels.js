function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatConference(league, conf) {
  if (!conf) return null;
  const v = String(conf).toLowerCase();
  if (league === "nfl") {
    if (v === "afc" || v === "nfc") return v.toUpperCase();
    return null;
  }
  if (v === "east") return "East";
  if (v === "west") return "West";
  return titleCase(v);
}

export function formatDivision(league, division) {
  if (!division) return null;
  const v = String(division).toLowerCase();
  if (league === "nfl") {
    const parts = v.split("_");
    if (parts.length < 2) return null;
    const [conf, ...rest] = parts;
    return `${conf.toUpperCase()} ${rest.map(titleCase).join(" ")}`;
  }
  return titleCase(v);
}
