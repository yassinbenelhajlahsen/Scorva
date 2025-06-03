// upsertStat.js
export default async function upsertStat(client, gameId, playerId, stats) {
  const query = `
    INSERT INTO stats (
      gameid, playerid, points, assists, rebounds, blocks, steals,
      fg, threept, ft, turnovers, plusminus, minutes,
      cmp, att, yds, cmp_pct, sacks, td, interceptions,
      g, a, pts, plus_minus, saves, save_pct, gaa,
      toi, shots, sm, bs, pn, pim, ht, tk, gv, fouls
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27,
      $28, $29, $30, $31, $32, $33, $34, $35, $36, $37
    )
    ON CONFLICT (gameid, playerid) DO UPDATE SET
      points     = EXCLUDED.points,
      assists    = EXCLUDED.assists,
      rebounds   = EXCLUDED.rebounds,
      blocks     = EXCLUDED.blocks,
      steals     = EXCLUDED.steals,
      fg         = EXCLUDED.fg,
      threept    = EXCLUDED.threept,
      ft         = EXCLUDED.ft,
      turnovers  = EXCLUDED.turnovers,
      plusminus  = EXCLUDED.plusminus,
      minutes    = EXCLUDED.minutes,
      cmp        = EXCLUDED.cmp,
      att        = EXCLUDED.att,
      yds        = EXCLUDED.yds,
      cmp_pct    = EXCLUDED.cmp_pct,
      sacks      = EXCLUDED.sacks,
      td         = EXCLUDED.td,
      interceptions = EXCLUDED.interceptions,
      g          = EXCLUDED.g,
      a          = EXCLUDED.a,
      pts        = EXCLUDED.pts,
      plus_minus = EXCLUDED.plus_minus,
      saves      = EXCLUDED.saves,
      save_pct   = EXCLUDED.save_pct,
      gaa        = EXCLUDED.gaa,
      toi        = EXCLUDED.toi,
      shots      = EXCLUDED.shots,
      sm         = EXCLUDED.sm,
      bs         = EXCLUDED.bs,
      pn         = EXCLUDED.pn,
      pim        = EXCLUDED.pim,
      ht         = EXCLUDED.ht,
      tk         = EXCLUDED.tk,
      gv         = EXCLUDED.gv,
      fouls = EXCLUDED.fouls
    RETURNING id;
  `;

  const values = [
    gameId, playerId,
    stats.points, stats.assists, stats.rebounds, stats.blocks, stats.steals,
    stats.fg, stats.threept, stats.ft, stats.turnovers, stats.plusminus, stats.minutes,
    stats.cmp, stats.att, stats.yds, stats.cmp_pct, stats.sacks, stats.td, stats.interceptions,
    stats.g, stats.a, stats.pts, stats.plus_minus, stats.saves, stats.save_pct, stats.gaa,
    stats.toi, stats.shots, stats.sm, stats.bs, stats.pn, stats.pim, stats.ht, stats.tk, stats.gv, stats.fouls
  ];

  const res = await client.query(query, values);
  return res.rows[0].id;
}
