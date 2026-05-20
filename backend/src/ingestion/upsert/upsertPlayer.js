export default async function upsertPlayer(
  client,
  player,
  teamId,
  league,
  { preserveExistingTeam = false } = {},
) {
  const resolvedTeamId = preserveExistingTeam ? null : teamId;

  // WHERE clause on the DO UPDATE skips the write entirely when no observable
  // field changed — prevents row rewrites + WAL on every ingest pass.
  // The outer CTE + fallback SELECT preserves "always return id" semantics
  // since DO UPDATE with a non-matching WHERE returns nothing.
  const query = `
    WITH upserted AS (
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
        draftinfo   = EXCLUDED.draftinfo,
        popularity  = players.popularity,
        status             = players.status,
        status_description = players.status_description,
        status_updated_at  = players.status_updated_at
      WHERE
        players.name      IS DISTINCT FROM EXCLUDED.name
        OR (NOT $12::boolean AND players.teamid IS DISTINCT FROM EXCLUDED.teamid)
        OR players.position  IS DISTINCT FROM EXCLUDED.position
        OR players.height    IS DISTINCT FROM EXCLUDED.height
        OR players.image_url IS DISTINCT FROM EXCLUDED.image_url
        OR players.jerseynum IS DISTINCT FROM EXCLUDED.jerseynum
        OR players.weight    IS DISTINCT FROM EXCLUDED.weight
        OR players.dob       IS DISTINCT FROM EXCLUDED.dob
        OR players.draftinfo IS DISTINCT FROM EXCLUDED.draftinfo
      RETURNING id
    )
    SELECT id FROM upserted
    UNION ALL
    SELECT id FROM players
      WHERE espn_playerid = $11 AND league = $10
        AND NOT EXISTS (SELECT 1 FROM upserted)
    LIMIT 1;
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
