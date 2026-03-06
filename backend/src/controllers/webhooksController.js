import pool from "../db/db.js";

export async function handleSupabaseAuth(req, res) {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!secret || req.headers.authorization !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { type, schema, record } = req.body;

  if (schema !== "auth" || type !== "INSERT" || !record?.id) {
    return res.status(200).json({ ok: true });
  }

  const email = record.email ?? null;
  const meta = record.raw_user_meta_data ?? {};

  // Email/password signups: first_name/last_name from user_metadata set during signUp()
  // Google OAuth: full_name from Google profile, split on first space
  let firstName = meta.first_name ?? null;
  let lastName = meta.last_name ?? null;

  if (!firstName && !lastName && meta.full_name) {
    const parts = meta.full_name.trim().split(/\s+/);
    firstName = parts[0] ?? null;
    lastName = parts.slice(1).join(" ") || null;
  }

  try {
    await pool.query(
      `INSERT INTO users (id, email, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             first_name = COALESCE(EXCLUDED.first_name, users.first_name),
             last_name  = COALESCE(EXCLUDED.last_name,  users.last_name)`,
      [record.id, email, firstName, lastName]
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook: failed to insert user", err);
    res.status(500).json({ error: "Failed to create user" });
  }
}
