// ESPN play clock parsing.
//
// NBA / NFL: clock.displayValue is REMAINING time per period ("7:59", "0:42").
// NHL:       clock.displayValue is ELAPSED time per period — convert via
//            nhlClockToRemaining when remaining time is needed.
//
// Sub-minute format ("5.4", "0.4") is also seen at end-of-period.

export function parseClockToSeconds(clock) {
  if (typeof clock !== "string" || clock.length === 0) return null;
  if (!clock.includes(":")) {
    const secs = parseFloat(clock);
    return Number.isNaN(secs) ? null : secs;
  }
  const parts = clock.split(":");
  if (parts.length !== 2) return null;
  const mins = parseInt(parts[0], 10);
  const secs = parseFloat(parts[1]);
  if (Number.isNaN(mins) || Number.isNaN(secs)) return null;
  return mins * 60 + secs;
}

export function nhlClockToRemaining(clock, period) {
  const elapsed = parseClockToSeconds(clock);
  if (elapsed === null) return null;
  // Playoff OT is 20 min; regular-season OT is 5 min — heuristic: elapsed > 300 means 20-min period.
  const periodLen = period > 3 && elapsed <= 300 ? 300 : 1200;
  return Math.max(0, periodLen - elapsed);
}
