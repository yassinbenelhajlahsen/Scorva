export default function PlayerAvgCard({ league, averages, season }) {
  let statsToDisplay = [];

  if (!averages || Object.keys(averages).length === 0 || averages == null) {
    return (
      <div className="relative overflow-hidden rounded-2xl w-full">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.06] via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <div className="text-accent text-[11px] uppercase tracking-[0.22em] font-semibold text-center pt-4 pb-3 border-b border-white/[0.05]">
            {season} Regular Season
          </div>
          <div className="p-5 flex items-center justify-center min-h-[80px]">
            <p className="text-sm text-center text-text-tertiary">No stats available.</p>
          </div>
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
    <div className="relative overflow-hidden rounded-2xl w-full">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.06] via-transparent to-transparent pointer-events-none" />
      <div className="relative">
        <div className="text-accent text-[11px] uppercase tracking-[0.22em] font-semibold text-center pt-4 pb-3 border-b border-white/[0.05]">
          {season} Regular Season
        </div>
        <div className="px-6 py-7">
          <ul className="flex flex-wrap gap-y-6 justify-around w-full">
            {statsToDisplay.map((stat, i) => (
              <li key={i} className="flex flex-col items-center flex-1 min-w-[72px]">
                <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium">{stat.label}</span>
                <span className="font-bold text-4xl mt-1.5 text-text-primary tabular-nums">
                  {stat.value ?? "--"}{stat.label.includes("%") && "%"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
