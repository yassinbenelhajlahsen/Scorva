/**
 * Infer rating roles for each ESPN play participant.
 *
 * Returns an array of { espnAthleteId, role } in participant-array order.
 *
 * Invariant: ESPN's participants[0] is always the primary actor of the play type
 * (the player whose play this is, matching team.id on the play).
 * participants[1], when present, is the secondary actor whose role is read from text.
 */

const SHOT_TYPE_KEYWORDS = [
  "jump shot", "layup", "dunk", "hook shot", "tip shot", "fade away",
  "step back", "pullup", "floating", "running", "driving", "cutting",
  "putback", "turnaround", "alley oop", "reverse",
];

const TURNOVER_KEYWORDS = ["turnover"];
const FOUL_KEYWORDS = ["foul"];
const REBOUND_KEYWORDS = ["rebound"];

function normalize(s) {
  return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isShotType(typeText) {
  const t = normalize(typeText);
  if (t.startsWith("free throw")) return true;
  return SHOT_TYPE_KEYWORDS.some((k) => t.includes(k));
}

export function inferParticipantRoles(play) {
  const participants = Array.isArray(play.participants) ? play.participants : [];
  if (participants.length === 0) return [];

  const typeText = normalize(play.type?.text);
  const text = normalize(play.text);
  const ids = participants.map((p) => String(p.athlete?.id ?? ""));

  // Free throws — single shooter
  if (typeText.startsWith("free throw")) {
    const role = play.scoringPlay ? "scorer" : "shot_attempter";
    return ids[0] ? [{ espnAthleteId: ids[0], role }] : [];
  }

  // Other shots
  if (isShotType(play.type?.text)) {
    if (play.scoringPlay) {
      const out = [{ espnAthleteId: ids[0], role: "scorer" }];
      if (ids[1] && /\bassists?\b/.test(text)) {
        out.push({ espnAthleteId: ids[1], role: "assister" });
      }
      return out.filter((p) => p.espnAthleteId);
    }
    // Missed shot
    const out = [{ espnAthleteId: ids[0], role: "shot_attempter" }];
    if (ids[1] && /\bblocks?\b/.test(text)) {
      out.push({ espnAthleteId: ids[1], role: "blocker" });
    }
    return out.filter((p) => p.espnAthleteId);
  }

  // Rebounds
  if (REBOUND_KEYWORDS.some((k) => typeText.includes(k))) {
    return ids[0] ? [{ espnAthleteId: ids[0], role: "rebounder" }] : [];
  }

  // Turnovers (including offensive foul turnovers — possession lost)
  if (TURNOVER_KEYWORDS.some((k) => typeText.includes(k))) {
    const out = [{ espnAthleteId: ids[0], role: "turnover_committer" }];
    if (ids[1] && /\bsteals?\b/.test(text)) {
      out.push({ espnAthleteId: ids[1], role: "stealer" });
    } else if (ids[1] && typeText.includes("offensive foul")) {
      // Offensive foul turnover: secondary participant is the defender who drew the charge
      out.push({ espnAthleteId: ids[1], role: "charge_drawer" });
    }
    return out.filter((p) => p.espnAthleteId);
  }

  // Offensive Charge — possession swing (treated as turnover for committer + charge for drawer)
  if (typeText.startsWith("offensive charge")) {
    const out = [{ espnAthleteId: ids[0], role: "turnover_committer" }];
    if (ids[1]) out.push({ espnAthleteId: ids[1], role: "charge_drawer" });
    return out.filter((p) => p.espnAthleteId);
  }

  // Fouls
  if (FOUL_KEYWORDS.some((k) => typeText.includes(k))) {
    return ids[0] ? [{ espnAthleteId: ids[0], role: "foul_committer" }] : [];
  }

  // Substitutions, timeouts, jump balls, end period, anything else — not rated
  return [];
}
