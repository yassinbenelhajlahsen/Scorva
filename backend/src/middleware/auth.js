import { createClient } from "@supabase/supabase-js";
import { ensureUserFromSupabase } from "../services/user/ensureUser.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Authentication required" });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user)
    return res.status(401).json({ error: "Invalid or expired token" });

  req.user = user;
  await ensureUserFromSupabase(user);
  next();
}
