export default async function upsertPlayer(
  client,
  player,
  teamId,
  league,
  { preserveExistingTeam = false } = {},
) {
  const resolvedTeamId = preserveExistingTeam ? null : teamId;

  const query = `
    INSERT INTO players (
      name, teamid, position, height, image_url,
      jerseynum, weight, dob, draftinfo,
      league, espn_playerid
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11
    )
    ON CONFLICT (espn_playerid, league) DO UPDATE SET
      name        = EXCLUDED.name,
      teamid      = CASE
                      WHEN $12::boolean THEN players.teamid
                      ELSE EXCLUDED.teamid
                    END,
      position    = EXCLUDED.position,
      height      = EXCLUDED.height,
      image_url   = EXCLUDED.image_url,
      jerseynum   = EXCLUDED.jerseynum,
      weight      = EXCLUDED.weight,
      dob         = EXCLUDED.dob,
      draftinfo   = EXCLUDED.draftinfo
    RETURNING id;
  `;

  const values = [
    player.name,
    resolvedTeamId,
    player.position || null,
    player.height || null,
    player.image_url || null,
    player.jerseynum != null ? (parseInt(String(player.jerseynum), 10) || null) : null,
    player.weight || null,
    player.birthdate || null,
    player.draftinfo || null,
    league,
    player.id, // ESPN player ID
    preserveExistingTeam,
  ];

  const res = await client.query(query, values);
  return res.rows[0].id;
}
