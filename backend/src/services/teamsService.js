import pool from "../db/db.js";

export async function getTeamsByLeague(league) {
  const result = await pool.query(
    `SELECT *
       FROM teams
      WHERE league = $1
      ORDER BY conf, name`,
    [league]
  );
  return result.rows;
}
