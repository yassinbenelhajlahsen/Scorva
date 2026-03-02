export default function PlayerAvgCard({ league, averages, season }) {
  let statsToDisplay = [];

  if (!averages || Object.keys(averages).length === 0 || averages == null) {
    return (
      <div className="bg-surface-elevated border border-white/[0.08] text-text-primary rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] w-fit overflow-hidden">
        <div className="bg-accent/10 text-accent text-center text-xs font-semibold uppercase tracking-widest py-2.5 px-6 border-b border-white/[0.06]">
          {season} Regular Season
        </div>
        <div className="p-5">
          <p className="text-sm text-center text-text-tertiary">No stats available.</p>
        </div>
      </div>
    );
  }

  if (league === "nba") {
    statsToDisplay = [
      { label: "PTS", value: averages.points },
      { label: "REB", value: averages.rebounds },
      { label: "AST", value: averages.assists },
      { label: "FG%", value: averages.fgPct },
    ];
  } else if (league === "nfl") {
    statsToDisplay = [
      { label: "YDS", value: averages.yards },
      { label: "TD",  value: averages.td },
      { label: "INT", value: averages.interceptions },
    ];
  } else {
    statsToDisplay = [
      { label: "Goals",   value: averages.goals },
      { label: "Assists", value: averages.assists },
      { label: "Saves",   value: averages.saves },
    ];
  }

  return (
    <div className="bg-surface-elevated border border-white/[0.08] text-text-primary rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] w-full overflow-hidden">
      {/* Tinted header */}
      <div className="bg-accent/10 text-accent text-center text-xs font-semibold uppercase tracking-widest py-2.5 px-6 border-b border-white/[0.06]">
        2025–26 Regular Season
      </div>

      {/* Stat row */}
      <div className="p-6">
        <ul className="flex flex-wrap gap-y-6 gap-x-10 justify-center">
          {statsToDisplay.map((stat, i) => (
            <li key={i} className="flex flex-col items-center min-w-[72px]">
              <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">{stat.label}</span>
              <span className="font-bold text-3xl sm:text-4xl mt-1 text-text-primary tabular-nums">
                {stat.value ?? "--"}
                {stat.label.includes("%") && "%"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
