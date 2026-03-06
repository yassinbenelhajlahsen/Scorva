import pool from "../db/db.js";

export async function getUser(userId) {
  const result = await pool.query(
    `SELECT id, email, first_name, last_name, default_league FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function updateUser(userId, { firstName, lastName, defaultLeague }) {
  const result = await pool.query(
    `UPDATE users
     SET first_name     = COALESCE($2, first_name),
         last_name      = COALESCE($3, last_name),
         default_league = COALESCE($4, default_league)
     WHERE id = $1
     RETURNING id, email, first_name, last_name, default_league`,
    [userId, firstName ?? null, lastName ?? null, defaultLeague ?? null]
  );
  return result.rows[0] ?? null;
}

export async function deleteUser(userId) {
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
}
