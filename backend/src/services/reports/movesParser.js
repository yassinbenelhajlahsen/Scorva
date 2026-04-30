// Pure-function parsers for ESPN transaction descriptions.
// Each function takes a description string (and a players Map keyed by lower-cased name)
// and returns plain data — no IO.

const SIGN_RE = /^\s*(?:re-?signed|signed|converted)/i;
const WAIVE_RE = /^\s*(?:waived(?:\/injured)?|released)/i;
const TRADE_RE = /^\s*(?:traded|acquired)/i;
const COACH_RE = /^\s*(?:announced the resignation|fired|hired|named)/i;

const AHL_RE = /\(AHL\)\.?\s*$/i;
const OPTION_RE = /\bexercised the .* option\b/i;

// Position prefix: 1–3 capital letters, optional trailing 's' for plurals (Fs, DEs, OLBs).
// Followed by a space and a capitalized word that begins the player name.
// Capture the candidate name span up to a delimiter.
const NAME_AFTER_POSITION_RE =
  /\b[A-Z]{1,3}s?\s+([A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*)*(?:\s+(?:Jr\.|Sr\.|II|III|IV))?)/g;

export function classifyAction(description) {
  if (!description) return null;
  if (COACH_RE.test(description)) return null; // filtered in v1
  if (SIGN_RE.test(description)) return "sign";
  if (WAIVE_RE.test(description)) return "waive";
  if (TRADE_RE.test(description)) return "trade";
  return null;
}

export function isAhlOnly(description) {
  return AHL_RE.test(description || "");
}

export function isOptionExercise(description) {
  return OPTION_RE.test(description || "");
}

export function extractPlayerNames(description, playersMap) {
  if (!description || !playersMap) return [];
  const seen = new Set();
  const out = [];

  // Primary pass: position-prefix regex — greedily match capitalized tokens after
  // a position abbreviation (F, DEs, OLB, etc.), then trim trailing tokens until
  // a map entry is found. Strip trailing sentence punctuation from the candidate
  // before lookup so names at end-of-sentence (e.g. "Klintman.") resolve correctly.
  for (const match of description.matchAll(NAME_AFTER_POSITION_RE)) {
    const candidate = match[1].trim().replace(/[.,;]+$/, "");
    const tokens = candidate.split(/\s+/);
    for (let n = tokens.length; n >= 1; n--) {
      const tryName = tokens.slice(0, n).join(" ").replace(/[.,;]+$/, "");
      const key = tryName.toLowerCase();
      const player = playersMap.get(key);
      if (player && !seen.has(player.id)) {
        seen.add(player.id);
        out.push(player);
        break;
      }
    }
  }

  // Secondary pass: scan directly for any player name in the map that appears
  // in the description text. This catches names listed after conjunctions like
  // "and" or commas without a repeated position prefix (e.g. "DEs Ali Gaye and Nate Lynn").
  // The lookahead allows sentence-ending punctuation (. , ;) after the name.
  for (const [key, player] of playersMap) {
    if (seen.has(player.id)) continue;
    // Build a case-insensitive literal search. Escape regex metacharacters in the name.
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRe = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, "i");
    if (nameRe.test(description)) {
      seen.add(player.id);
      out.push(player);
    }
  }

  return out;
}

export function parseMove({ description, team, players }) {
  if (isAhlOnly(description)) return null;
  if (isOptionExercise(description)) return null;

  const action = classifyAction(description);
  if (!action) return null;

  const matched = extractPlayerNames(description, players);
  if (matched.length === 0) return null;

  let fromTeam = null;
  let toTeam = null;
  if (action === "sign") {
    toTeam = team;
  } else if (action === "waive") {
    fromTeam = team;
  } else if (action === "trade") {
    // V1: announcing team is the "from" side, "to" remains null when un-resolvable.
    // A follow-up can parse "to/from/for {TEAM}" against a team-name index.
    fromTeam = team;
  }

  return matched.map((player) => ({ action, fromTeam, toTeam, player }));
}
