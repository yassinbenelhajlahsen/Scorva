const MAX_LENGTH = 200;

const SEPARATORS = [
  /(?:^|\s+)vs\.?(?=\s+|$)/i, // 'vs' or 'vs.' as a whole word
  /(?:^|\s+)v\.?(?=\s+|$)/i,  // 'v' or 'v.' as a whole word
  /(?:^|\s+)@(?=\s+|$)/,      // '@' as a whole token
  /(?:^|\s+)at(?=\s+|$)/i,    // 'at' as a whole word
  /(?:^|\s+)-(?=\s+|$)/,      // '-' as a whole token (NOT inside hyphenated names)
];

export function parseSearchTerm(raw) {
  if (typeof raw !== "string") return { kind: "empty" };
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > MAX_LENGTH) return { kind: "empty" };

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
