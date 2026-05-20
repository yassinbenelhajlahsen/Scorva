export default async function upsertTeam(client, espnId, league, teamInfo) {
  // Same no-op-write pattern as upsertPlayer — WHERE on DO UPDATE skips
  // rewrites when nothing changed (teams.record was rewriting 285k times on
  // 99 rows). CTE + fallback SELECT preserves "always return id" semantics.
  const text = `
    WITH upserted AS (
      INSERT INTO teams
        (espnid, league, name, shortname, location, logo_url, record, homerecord, awayrecord, primary_color, abbreviation)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (espnid, league ) DO UPDATE
        SET name          = EXCLUDED.name,
            league        = EXCLUDED.league,
            shortname     = EXCLUDED.shortname,
            location      = EXCLUDED.location,
            logo_url      = EXCLUDED.logo_url,
            record        = EXCLUDED.record,
            homerecord    = EXCLUDED.homerecord,
            awayrecord    = EXCLUDED.awayrecord,
            primary_color = EXCLUDED.primary_color,
            abbreviation  = EXCLUDED.abbreviation
        WHERE
          teams.name          IS DISTINCT FROM EXCLUDED.name
          OR teams.shortname     IS DISTINCT FROM EXCLUDED.shortname
          OR teams.location      IS DISTINCT FROM EXCLUDED.location
          OR teams.logo_url      IS DISTINCT FROM EXCLUDED.logo_url
          OR teams.record        IS DISTINCT FROM EXCLUDED.record
          OR teams.homerecord    IS DISTINCT FROM EXCLUDED.homerecord
          OR teams.awayrecord    IS DISTINCT FROM EXCLUDED.awayrecord
          OR teams.primary_color IS DISTINCT FROM EXCLUDED.primary_color
          OR teams.abbreviation  IS DISTINCT FROM EXCLUDED.abbreviation
      RETURNING id
    )
    SELECT id FROM upserted
    UNION ALL
    SELECT id FROM teams
      WHERE espnid = $1 AND league = $2
        AND NOT EXISTS (SELECT 1 FROM upserted)
    LIMIT 1;
  `;
  const values = [
    espnId,
    league,
    teamInfo.name,
    teamInfo.shortname || null,
    teamInfo.location || null,
    teamInfo.logo_url || null,
    teamInfo.record,
    teamInfo.homerecord || null,
    teamInfo.awayrecord || null,
    teamInfo.primary_color || null,
    teamInfo.abbreviation ? teamInfo.abbreviation.toUpperCase() : null,
  ];

  const res = await client.query(text, values);
  return res.rows[0].id;
}
