export default function PlayerAvgCard({ league, position, averages, season}) {
  let statsToDisplay = [];

 if (!averages || Object.keys(averages).length === 0 || averages == null) {
    return (
      <div className="border border-zinc-700 bg-zinc-800 text-white rounded-lg shadow-md w-fit overflow-hidden">
        <div className="bg-orange-400 text-center text-sm font-bold uppercase py-2 px-4">
          {season} Regular Season Stats
        </div>
        <div className="p-4">
          <p className="text-sm text-center text-gray-300">No stats available.</p>
        </div>
      </div>
    );
  }

  // Decide what to show based on league and position
  if (league === "nba") {
    statsToDisplay = [
      { label: "PTS", value: averages.points },
      { label: "REB", value: averages.rebounds },
      { label: "AST", value: averages.assists },
      { label: "FG%", value: averages.fgPct*100 },
    ];
  } else if (league === "nfl") {
    if (position === "QB") {
      statsToDisplay = [
        { label: "Pass YDS", value: averages.passYards },
        { label: "TD", value: averages.touchdowns },
        { label: "INT", value: averages.interceptions }
      ];
    } else if (["RB", "WR"].includes(position)) {
      statsToDisplay = [
        { label: "Rush YDS", value: averages.rushYards },
        { label: "REC", value: averages.receptions },
        { label: "TD", value: averages.touchdowns }
      ];
    }
  } else if (league === "nhl") {
    if (position === "G") {
      statsToDisplay = [
        { label: "Saves", value: averages.saves },
        { label: "SV%", value: averages.savePct },
        { label: "GAA", value: averages.gaa }
      ];
    } else {
      statsToDisplay = [
        { label: "Goals", value: averages.goals },
        { label: "Assists", value: averages.assists },
        { label: "Points", value: averages.points }
      ];
    }
  }

  return (
   <div className="border border-zinc-700 bg-zinc-800 text-white rounded-lg shadow-md w-full max-w-screen">
  {/* Orange title bar */}
  <div className="w-full bg-orange-400 text-center text-sm sm:text-md font-bold uppercase py-2 px-4">
    {season} Regular Season Stats
  </div>

  {/* Card body */}
  <div className="p-6">
    <ul className="flex flex-wrap gap-y-6 gap-x-10 justify-center">
      {statsToDisplay.map((stat, i) => (
        <li key={i} className="flex flex-col items-center min-w-[80px]">
          <span className="text-xs sm:text-sm">{stat.label}</span>
          <span className="font-semibold text-3xl sm:text-4xl mt-1">
            {stat.value}
            {stat.label.includes("%") && "%"}
          </span>
        </li>
      ))}
    </ul>
  </div>
</div>

  );
}