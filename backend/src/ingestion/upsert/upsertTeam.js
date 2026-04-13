export default async function upsertTeam(client, espnId, league, teamInfo) {
  const text = `
    INSERT INTO teams
      (espnid, league, name, shortname, location, logo_url, record, homerecord, awayrecord, primary_color)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (espnid, league ) DO UPDATE
      SET name          = EXCLUDED.name,
          league        = EXCLUDED.league,
          shortname     = EXCLUDED.shortname,
          location      = EXCLUDED.location,
          logo_url      = EXCLUDED.logo_url,
          record        = EXCLUDED.record,
          homerecord    = EXCLUDED.homerecord,
          awayrecord    = EXCLUDED.awayrecord,
          primary_color = EXCLUDED.primary_color
    RETURNING id;
  `;
  const values = [
    espnId,
    league,
    teamInfo.name, // $3 → “name”
    teamInfo.shortname || null, // $4 → “shortname”
    teamInfo.location || null, // $5 → “location”
    teamInfo.logo_url || null, // $6 → “logo_url”
    teamInfo.record, // $7
    teamInfo.homerecord || null, // $8 → “homerecord”
    teamInfo.awayrecord || null, // $9 → “awayrecord”
    teamInfo.primary_color || null, // $10 → “primary_color”
  ];

  const res = await client.query(text, values);
  return res.rows[0].id;
}
