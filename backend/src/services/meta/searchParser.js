const MAX_LENGTH = 200;

const SEPARATOR_ONLY = /^(vs\.?|v\.?|@|at|-)\s*$/i;

const SEPARATORS = [
  /\s+vs\.?\s+/i, // ' vs ' / ' vs. ' (space before and after)
  /^vs\.?\s+/i,   // leading 'vs ' at start of string
  /\s+vs\.?$/i,   // trailing ' vs' at end of string
  /\s+v\.?\s+/i,  // ' v ' / ' v. '
  /^v\.?\s+/i,    // leading 'v ' at start
  /\s+v\.?$/i,    // trailing ' v' at end
  /\s+@\s+/,      // ' @ '
  /^@\s+/,        // leading '@' at start
  /\s+@$/,        // trailing '@' at end
  /\s+at\s+/i,    // ' at '
  /^at\s+/i,      // leading 'at ' at start
  /\s+at$/i,      // trailing ' at' at end
  /\s+-\s+/,      // ' - '
  /^-\s+/,        // leading '-' at start
  /\s+-$/,        // trailing '-' at end
];

export function parseSearchTerm(raw) {
  if (typeof raw !== "string") return { kind: "empty" };
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > MAX_LENGTH) return { kind: "empty" };
  if (SEPARATOR_ONLY.test(normalized)) return { kind: "empty" };

  for (const re of SEPARATORS) {
    const match = re.exec(normalized);
    if (!match) continue;
    const lhs = normalized.slice(0, match.index).trim();
    const rhs = normalized.slice(match.index + match[0].length).trim();
    if (lhs && rhs) return { kind: "matchup", lhs, rhs };
    if (lhs) return { kind: "single", token: lhs };
    if (rhs) return { kind: "single", token: rhs };
    return { kind: "empty" };
  }

  return { kind: "single", token: normalized };
}
