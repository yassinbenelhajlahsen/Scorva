export default async function upsertTeam(client, espnId, league, teamInfo) {

  const text = `
    INSERT INTO teams
      (espnid, league, name, shortname, location, logo_url, record, homerecord, awayrecord)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (espnid, league ) DO UPDATE
      SET name       = EXCLUDED.name,
          league     = EXCLUDED.league,
          shortname  = EXCLUDED.shortname,
          location   = EXCLUDED.location,
          logo_url   = EXCLUDED.logo_url,
          record     = EXCLUDED.record,
          homerecord = EXCLUDED.homerecord,
          awayrecord = EXCLUDED.awayrecord
    RETURNING id;
  `;
  const values = [
    espnId,
    league,
    teamInfo.name,                // $3 → “name”
    teamInfo.shortname || null,    // $4 → “shortname”
    teamInfo.location      || null,       // $5 → “location”
    teamInfo.logo_url       || null,       // $6 → “logo_url”
    teamInfo.record,                       // $
    teamInfo.homerecord    || null,       // $7 → “homerecord”
    teamInfo.awayrecord    || null        // $8 → “awayrecord”
  ];

  
    const res = await client.query(text, values);
    return res.rows[0].id;

}