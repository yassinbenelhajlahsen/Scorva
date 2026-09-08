// Cheap fingerprint of "which games have gone Final" for one league-season.
// Ingestion workers memoize expensive rebuilds (streak scans, embedding
// recomputes) on this value: if no game finalized since the last run, the
// inputs are identical and the work is skipped. games is small and indexed on
// (league, season, date), so this costs a few pages.
export async function finalsSignature(db, league, season) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS finals, MAX(date)::text AS last_date
       FROM games
      WHERE league = $1 AND season = $2 AND status ILIKE 'Final%'`,
    [league, season],
  );
  const row = rows[0] ?? {};
  return `${row.finals ?? 0}:${row.last_date ?? "none"}`;
}
