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
      parseInteger(minutes)  = EXCLUDED.minutes,
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

  const values = [
    gameId,              // $1
    playerId,            // $2
    stats.points || null,       // $3
    stats.assists || null,      // $4
    stats.rebounds || null,     // $5
    stats.blocks || null,       // $6
    stats.steals || null,       // $7
    stats.fg || null,           // $8
    stats.threept || null,      // $9
    stats.ft || null,           // $10
    stats.turnovers || null,    // $11
    stats.plusminus || null,    // $12
    stats.minutes || null,      // $13
    stats.cmpatt || null,       // $14
    stats.yds !== null && stats.yds !== undefined ? Number(stats.yds) : null,    
    stats.sacks || null,        // $16
stats.td !== null && stats.td !== undefined 
  ? Number(stats.td.split('/')[0])  // Takes the first number from "2/2"
  : null,     
  stats.interceptions || null,// $18
    stats.g || null,            // $19
    stats.a || null,            // $20
    stats.saves || null,        // $23
    stats.savePct || null,     // $24
    stats.ga || null,          // $25
    stats.toi || null,          // $26
    stats.shots || null,        // $27
    stats.sm || null,           // $28
    stats.bs || null,           // $29
    stats.pn || null,           // $30
    stats.pim || null,          // $31
    stats.ht || null,           // $32
    stats.tk || null,           // $33
    stats.gv || null,           // $34
    stats.fouls || null,        // $35
  ];

  

  try {
    const res = await client.query(query, values);
    return res.rows[0].id;
  } catch (err) {
    console.error("🔴 [ERROR upsertStat] Failed SQL:", err.message);
    throw err;
  }
}
