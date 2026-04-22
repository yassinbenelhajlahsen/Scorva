import pool from "../../db/db.js";
import logger from "../../logger.js";

export async function ensureUser(userId, { email, firstName, lastName } = {}) {
  await pool.query(
    `INSERT INTO users (id, email, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET email      = COALESCE(EXCLUDED.email,      users.email),
           first_name = COALESCE(EXCLUDED.first_name, users.first_name),
           last_name  = COALESCE(EXCLUDED.last_name,  users.last_name)`,
    [userId, email ?? null, firstName ?? null, lastName ?? null]
  );
}

export function extractProfileFromSupabaseUser(user) {
  const meta = user?.user_metadata ?? {};
  let firstName = meta.first_name ?? null;
  let lastName = meta.last_name ?? null;

  if (!firstName && !lastName && meta.full_name) {
    const parts = meta.full_name.trim().split(/\s+/);
    firstName = parts[0] ?? null;
    lastName = parts.slice(1).join(" ") || null;
  }

  return {
    email: user?.email ?? null,
    firstName,
    lastName,
  };
}

export async function ensureUserFromSupabase(user) {
  if (!user?.id) return;
  try {
    await ensureUser(user.id, extractProfileFromSupabaseUser(user));
  } catch (err) {
    logger.error({ err, userId: user.id }, "ensureUserFromSupabase failed");
  }
}
