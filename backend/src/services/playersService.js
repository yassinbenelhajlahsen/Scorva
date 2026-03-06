import pool from "../db/db.js";

export async function getPlayersByLeague(league) {
  const result = await pool.query(
    `SELECT *
       FROM players
      WHERE league = $1
      ORDER BY position`,
    [league]
  );
  return result.rows;
}
