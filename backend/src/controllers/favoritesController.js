import * as favoritesService from "../services/favoritesService.js";

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
    console.error(err);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
}

export async function addFavoritePlayer(req, res) {
  try {
    const playerId = parseInt(req.params.playerId);
    await favoritesService.addFavoritePlayer(req.user.id, playerId, profileFromUser(req.user));
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add favorite player" });
  }
}

export async function removeFavoritePlayer(req, res) {
  try {
    const playerId = parseInt(req.params.playerId);
    await favoritesService.removeFavoritePlayer(req.user.id, playerId);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove favorite player" });
  }
}

export async function addFavoriteTeam(req, res) {
  try {
    const teamId = parseInt(req.params.teamId);
    await favoritesService.addFavoriteTeam(req.user.id, teamId, profileFromUser(req.user));
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add favorite team" });
  }
}

export async function removeFavoriteTeam(req, res) {
  try {
    const teamId = parseInt(req.params.teamId);
    await favoritesService.removeFavoriteTeam(req.user.id, teamId);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove favorite team" });
  }
}

export async function checkFavorites(req, res) {
  try {
    const playerIds = req.query.playerIds
      ? req.query.playerIds.split(",").map(Number).filter(Boolean)
      : [];
    const teamIds = req.query.teamIds
      ? req.query.teamIds.split(",").map(Number).filter(Boolean)
      : [];
    const result = await favoritesService.checkFavorites(
      req.user.id,
      playerIds,
      teamIds
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check favorites" });
  }
}
