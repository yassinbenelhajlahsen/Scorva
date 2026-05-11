function parseFraction(str) {
  if (!str || typeof str !== "string") return [0, 0];
  const parts = str.split("-");
  if (parts.length !== 2) return [0, 0];
  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);
  return [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0];
}

function parseSlash(str) {
  if (!str || typeof str !== "string") return [0, 0];
  const parts = str.split("/");
  if (parts.length !== 2) return [0, 0];
  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);
  return [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0];
}

function num(v) {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function sumStat(players, key) {
  return players.reduce((acc, p) => acc + num(p?.stats?.[key]), 0);
}

function sumFractionMade(players, key) {
  return players.reduce((acc, p) => acc + parseFraction(p?.stats?.[key])[0], 0);
}

function sumFractionAtt(players, key) {
  return players.reduce((acc, p) => acc + parseFraction(p?.stats?.[key])[1], 0);
}

function pct(made, att) {
  if (att <= 0) return { display: "—", compare: -Infinity };
  const v = (made / att) * 100;
  return { display: `${v.toFixed(1)}%`, compare: v };
}

function intRow(value) {
  return { display: String(value), compare: value };
}

const NBA_ROWS = [
  { label: "PTS", compute: (ps) => intRow(sumStat(ps, "PTS")) },
  {
    label: "FG%",
    compute: (ps) => pct(sumFractionMade(ps, "FG"), sumFractionAtt(ps, "FG")),
  },
  {
    label: "3PT%",
    compute: (ps) => pct(sumFractionMade(ps, "3PT"), sumFractionAtt(ps, "3PT")),
  },
  {
    label: "FT%",
    compute: (ps) => pct(sumFractionMade(ps, "FT"), sumFractionAtt(ps, "FT")),
  },
  { label: "REB", compute: (ps) => intRow(sumStat(ps, "REB")) },
  { label: "AST", compute: (ps) => intRow(sumStat(ps, "AST")) },
  { label: "STL", compute: (ps) => intRow(sumStat(ps, "STL")) },
  { label: "BLK", compute: (ps) => intRow(sumStat(ps, "BLK")) },
  { label: "TO", compute: (ps) => intRow(sumStat(ps, "TO")), lowerIsBetter: true },
  { label: "PF", compute: (ps) => intRow(sumStat(ps, "PF")), lowerIsBetter: true },
];

const NHL_ROWS = [
  { label: "GOALS", compute: (ps) => intRow(sumStat(ps, "G")) },
  { label: "SHOTS", compute: (ps) => intRow(sumStat(ps, "SHOTS")) },
  { label: "HITS", compute: (ps) => intRow(sumStat(ps, "HT")) },
  { label: "BLOCKS", compute: (ps) => intRow(sumStat(ps, "BS")) },
  { label: "TAKEAWAYS", compute: (ps) => intRow(sumStat(ps, "TK")) },
  { label: "GIVEAWAYS", compute: (ps) => intRow(sumStat(ps, "GV")), lowerIsBetter: true },
  { label: "PIM", compute: (ps) => intRow(sumStat(ps, "PIM")), lowerIsBetter: true },
  {
    label: "SAVE%",
    compute: (ps) => {
      const saves = sumStat(ps, "SAVES");
      const ga = sumStat(ps, "GA");
      return pct(saves, saves + ga);
    },
  },
];

const NFL_OFFENSE_ROWS = [
  { label: "PASS YDS", compute: (ps) => intRow(sumStat(ps, "YDS")) },
  { label: "PASS TD", compute: (ps) => intRow(sumStat(ps, "TD")) },
  {
    label: "CMP/ATT",
    compute: (ps) => {
      const cmp = ps.reduce((acc, p) => acc + parseSlash(p?.stats?.CMPATT)[0], 0);
      const att = ps.reduce((acc, p) => acc + parseSlash(p?.stats?.CMPATT)[1], 0);
      return {
        display: `${cmp}/${att}`,
        compare: att > 0 ? cmp / att : 0,
      };
    },
  },
  {
    label: "INT THROWN",
    compute: (ps) => intRow(sumStat(ps, "INT")),
    lowerIsBetter: true,
  },
  {
    label: "SACKS ALLOWED",
    compute: (ps) => intRow(sumFractionMade(ps, "SCKS")),
    lowerIsBetter: true,
  },
];

const NFL_DEFENSE_ROWS = [
  { label: "SACKS", compute: (ps) => intRow(sumFractionMade(ps, "SCKS")) },
  { label: "INTERCEPTIONS", compute: (ps) => intRow(sumStat(ps, "INT")) },
];

const CONFIG = {
  nba: { rows: NBA_ROWS },
  nhl: { rows: NHL_ROWS },
  nfl: {
    sections: [
      {
        title: "Offense",
        filter: (p) => p?.stats?.CMPATT != null,
        rows: NFL_OFFENSE_ROWS,
      },
      {
        title: "Defense",
        filter: (p) => p?.stats?.CMPATT == null,
        rows: NFL_DEFENSE_ROWS,
      },
    ],
  },
};

function StatRow({ label, valA, valB, displayA, displayB, lowerIsBetter }) {
  const tie = valA === valB;
  const aWins = !tie && (lowerIsBetter ? valA < valB : valA > valB);
  const bWins = !tie && (lowerIsBetter ? valB < valA : valB > valA);

  return (
    <div className="flex items-center">
      <span
        className={`flex-1 text-right text-sm font-semibold tabular-nums ${
          aWins ? "text-accent" : "text-text-primary"
        }`}
      >
        {displayA}
      </span>
      <span className="w-28 text-center text-xs font-semibold text-text-tertiary uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`flex-1 text-left text-sm font-semibold tabular-nums ${
          bWins ? "text-accent" : "text-text-primary"
        }`}
      >
        {displayB}
      </span>
    </div>
  );
}

function TeamHeader({ team, align }) {
  const justify = align === "right" ? "justify-end" : "justify-start";
  return (
    <div className={`flex items-center gap-2 ${justify} flex-1 min-w-0`}>
      {align === "right" && (
        <span className="text-sm font-semibold text-text-primary truncate">
          {team.info.name}
        </span>
      )}
      {team.info.logoUrl && (
        <img
          src={team.info.logoUrl}
          alt={team.info.name}
          className="w-8 h-8 object-contain shrink-0"
        />
      )}
      {align === "left" && (
        <span className="text-sm font-semibold text-text-primary truncate">
          {team.info.name}
        </span>
      )}
    </div>
  );
}

function renderRows(rows, homePlayers, awayPlayers) {
  return rows.map((row) => {
    const a = row.compute(homePlayers);
    const b = row.compute(awayPlayers);
    return (
      <StatRow
        key={row.label}
        label={row.label}
        valA={a.compare}
        valB={b.compare}
        displayA={a.display}
        displayB={b.display}
        lowerIsBetter={!!row.lowerIsBetter}
      />
    );
  });
}

function RatingRow({ home, away }) {
  return (
    <StatRow
      label="RATING"
      valA={home}
      valB={away}
      displayA={home.toFixed(1)}
      displayB={away.toFixed(1)}
      lowerIsBetter={false}
    />
  );
}

export default function TeamComparison({ homeTeam, awayTeam, league, homeRating, awayRating }) {
  const homePlayers = homeTeam?.players || [];
  const awayPlayers = awayTeam?.players || [];
  const config = CONFIG[league];
  if (!config) return null;
  if (homePlayers.length === 0 && awayPlayers.length === 0) return null;

  const hasRating = homeRating != null && awayRating != null;

  return (
    <div className="mt-6 w-full bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] p-6 sm:p-8">
      <h3 className="text-2xl font-bold tracking-tight text-text-primary mb-6 text-center">
        Team Comparison
      </h3>

      <div className="flex items-center gap-4 pb-5 mb-5 border-b border-white/[0.06]">
        <TeamHeader team={homeTeam} align="left" />
        <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
          vs
        </span>
        <TeamHeader team={awayTeam} align="right" />
      </div>

      {config.sections ? (
        <div className="space-y-6">
          {hasRating && (
            <div>
              <div className="space-y-3">
                <RatingRow home={homeRating} away={awayRating} />
              </div>
              <div className="border-t border-white/[0.06] mt-6" />
            </div>
          )}
          {config.sections.map((section, i) => {
            const home = homePlayers.filter(section.filter);
            const away = awayPlayers.filter(section.filter);
            return (
              <div key={section.title}>
                <h4 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3 text-center">
                  {section.title}
                </h4>
                <div className="space-y-3">
                  {renderRows(section.rows, home, away)}
                </div>
                {i < config.sections.length - 1 && (
                  <div className="border-t border-white/[0.06] mt-6" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {hasRating && <RatingRow home={homeRating} away={awayRating} />}
          {renderRows(config.rows, homePlayers, awayPlayers)}
        </div>
      )}
    </div>
  );
}
