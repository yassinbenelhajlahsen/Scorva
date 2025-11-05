function parseInteger(value) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

export default async function upsertStat(client, gameId, playerId, stats) {
  const query = `
    INSERT INTO stats (
      gameid,
      playerid,
      points,
      assists,
      rebounds,
      blocks,
      steals,
      fg,
      threept,
      ft,
      turnovers,
      plusminus,
      minutes,
      cmpatt,
      yds,
      sacks,
      td,
      interceptions,
      g,
      a,
      saves,
      savePct,
      ga,
      toi,
      shots,
      sm,
      bs,
      pn,
      pim,
      ht,
      tk,
      gv,
      fouls
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14, $15::INTEGER, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27,
      $28, $29, $30, $31, $32, $33
    )
    ON CONFLICT (gameid, playerid) DO UPDATE SET
      points       = EXCLUDED.points,
      assists      = EXCLUDED.assists,
      rebounds     = EXCLUDED.rebounds,
      blocks       = EXCLUDED.blocks,
      steals       = EXCLUDED.steals,
      fg           = EXCLUDED.fg,
      threept      = EXCLUDED.threept,
      ft           = EXCLUDED.ft,
      turnovers    = EXCLUDED.turnovers,
      plusminus    = EXCLUDED.plusminus,
      minutes  = EXCLUDED.minutes,
      cmpatt       = EXCLUDED.cmpatt,
      yds          = EXCLUDED.yds,
      sacks        = EXCLUDED.sacks,
      td           = EXCLUDED.td,
      interceptions = EXCLUDED.interceptions,
      g            = EXCLUDED.g,
      a            = EXCLUDED.a,
      saves        = EXCLUDED.saves,
      savePct     = EXCLUDED.savePct,
      ga          = EXCLUDED.ga,
      toi          = EXCLUDED.toi,
      shots        = EXCLUDED.shots,
      sm           = EXCLUDED.sm,
      bs           = EXCLUDED.bs,
      pn           = EXCLUDED.pn,
      pim          = EXCLUDED.pim,
      ht           = EXCLUDED.ht,
      tk           = EXCLUDED.tk,
      gv           = EXCLUDED.gv,
      fouls        = EXCLUDED.fouls
    RETURNING id;
  `;

  let tdValue = null;
  if (stats.td !== null && stats.td !== undefined) {
    if (typeof stats.td === "string" && stats.td.includes("/")) {
      tdValue = Number(stats.td.split("/")[0]);
    } else {
      tdValue = Number(stats.td);
    }
  }

  const values = [
    gameId,
    playerId,
    stats.points || null,
    stats.assists || null,
    stats.rebounds || null,
    stats.blocks || null,
    stats.steals || null,
    stats.fg || null,
    stats.threept || null,
    stats.ft || null,
    stats.turnovers || null,
    stats.plusminus || null,
    parseInteger(stats.minutes),
    stats.cmpatt || null,
    stats.yds !== null && stats.yds !== undefined ? Number(stats.yds) : null,
    stats.sacks || null,
    tdValue, // fixed!
    stats.interceptions || null,
    stats.g || null,
    stats.a || null,
    stats.saves || null,
    stats.savePct || null,
    stats.ga || null,
    stats.toi || null,
    stats.shots || null,
    stats.sm || null,
    stats.bs || null,
    stats.pn || null,
    stats.pim || null,
    stats.ht || null,
    stats.tk || null,
    stats.gv || null,
    stats.fouls || null,
  ];

  try {
    const res = await client.query(query, values);
    return res.rows[0].id;
  } catch (err) {
    console.error("🔴 [ERROR upsertStat] Failed SQL:", err.message);
    throw err;
  }
}
