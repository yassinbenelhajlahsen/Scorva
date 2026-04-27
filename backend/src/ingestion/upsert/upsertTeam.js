export default async function upsertTeam(client, espnId, league, teamInfo) {
  const text = `
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
    RETURNING id;
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
