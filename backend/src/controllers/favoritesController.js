import * as favoritesService from "../services/favoritesService.js";
import logger from "../logger.js";

function profileFromUser(user) {
  const meta = user.user_metadata ?? {};
  let firstName = meta.first_name ?? null;
  let lastName = meta.last_name ?? null;
  if (!firstName && !lastName && meta.full_name) {
    const parts = meta.full_name.trim().split(/\s+/);
    firstName = parts[0] ?? null;
    lastName = parts.slice(1).join(" ") || null;
  }
  return { email: user.email ?? null, firstName, lastName };
}

export async function getFavorites(req, res) {
  try {
    const data = await favoritesService.getFavorites(req.user.id);
    res.json(data);
  } catch (err) {
    logger.error({ err }, "Failed to fetch favorites");
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
}

function parseId(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

export async function addFavoritePlayer(req, res) {
  try {
    const playerId = parseId(req.params.playerId);
    if (!playerId) return res.status(400).json({ error: "Invalid player ID" });
    await favoritesService.addFavoritePlayer(req.user.id, playerId, profileFromUser(req.user));
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to add favorite player");
    res.status(500).json({ error: "Failed to add favorite player" });
  }
}

export async function removeFavoritePlayer(req, res) {
  try {
    const playerId = parseId(req.params.playerId);
    if (!playerId) return res.status(400).json({ error: "Invalid player ID" });
    await favoritesService.removeFavoritePlayer(req.user.id, playerId);
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to remove favorite player");
    res.status(500).json({ error: "Failed to remove favorite player" });
  }
}

export async function addFavoriteTeam(req, res) {
  try {
    const teamId = parseId(req.params.teamId);
    if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
    await favoritesService.addFavoriteTeam(req.user.id, teamId, profileFromUser(req.user));
    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to add favorite team");
    res.status(500).json({ error: "Failed to add favorite team" });
  }
}

export async function removeFavoriteTeam(req, res) {
  try {
    const teamId = parseId(req.params.teamId);
    if (!teamId) return res.status(400).json({ error: "Invalid team ID" });
    await favoritesService.removeFavoriteTeam(req.user.id, teamId);
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to remove favorite team");
    res.status(500).json({ error: "Failed to remove favorite team" });
  }
}

export async function checkFavorites(req, res) {
  try {
    const playerIds = req.query.playerIds
      ? req.query.playerIds.split(",").map(s => parseInt(s, 10)).filter(Number.isFinite)
      : [];
    const teamIds = req.query.teamIds
      ? req.query.teamIds.split(",").map(s => parseInt(s, 10)).filter(Number.isFinite)
      : [];
    const result = await favoritesService.checkFavorites(
      req.user.id,
      playerIds,
      teamIds
    );
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Failed to check favorites");
    res.status(500).json({ error: "Failed to check favorites" });
  }
}
