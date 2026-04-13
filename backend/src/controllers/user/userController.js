import { createClient } from "@supabase/supabase-js";
import * as userService from "../../services/user/userService.js";
import logger from "../../logger.js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

export async function getProfile(req, res) {
  try {
    const user = await userService.getUser(req.user.id);
    res.json(user ?? { id: req.user.id, default_league: null });
  } catch (err) {
    logger.error({ err }, "Failed to fetch profile");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}

const VALID_LEAGUES = ["nba", "nfl", "nhl"];

export async function updateProfile(req, res) {
  try {
    const { firstName, lastName, defaultLeague } = req.body ?? {};
    if (firstName === undefined && lastName === undefined && defaultLeague === undefined) {
      return res.status(400).json({ error: "At least one field required" });
    }
    if (firstName !== undefined && typeof firstName !== "string") {
      return res.status(400).json({ error: "firstName must be a string" });
    }
    if (lastName !== undefined && typeof lastName !== "string") {
      return res.status(400).json({ error: "lastName must be a string" });
    }
    if (defaultLeague !== undefined && !VALID_LEAGUES.includes(defaultLeague)) {
      return res.status(400).json({ error: "Invalid league. Must be nba, nfl, or nhl" });
    }
    const user = await userService.updateUser(req.user.id, { firstName, lastName, defaultLeague });
    res.json({ ok: true, user });
  } catch (err) {
    logger.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
}

export async function deleteAccount(req, res) {
  try {
    // Delete Supabase auth user first — if this fails, DB row stays intact
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    if (error) throw error;
    // Then delete our DB row (cascades favorites)
    await userService.deleteUser(req.user.id);
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete account");
    res.status(500).json({ error: "Failed to delete account" });
  }
}
