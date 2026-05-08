/**
 * Extracts shot distance (in feet) from an ESPN NBA play.
 *
 * ESPN normalizes coordinates so the offensive basket is always at (25, 0).
 * Free throws carry sentinel coordinates near INT_MIN — return null for those.
 * Returns null for non-shooting plays.
 *
 * Verified empirically: math distance vs ESPN's text-stated "X-foot" distance
 * agrees to within ±2 ft on a sample of 123 NBA shots, both home and away teams.
 */
export function extractShotDistance(play) {
  if (!play.shootingPlay) return null;
  if (/free throw/i.test(play.text || "")) return null;
  const c = play.coordinate;
  if (!c || c.x == null || c.y == null) return null;
  if (c.x < -1000 || c.y < -1000) return null;            // FT garbage sentinel
  const dist = Math.round(Math.sqrt((c.x - 25) ** 2 + c.y ** 2));
  return dist > 0 && dist < 90 ? dist : null;
}
