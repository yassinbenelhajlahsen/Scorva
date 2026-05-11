const ITEMS = [
  { key: "week",   label: "Week" },
  { key: "month",  label: "Month" },
  { key: "season", label: "Season" },
];

export default function TeamRankings({ rankings }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
      {ITEMS.map(({ key, label }) => {
        const rank = rankings?.[key] ?? null;
        return (
          <div key={key} className="flex flex-col items-center gap-1 px-3 first:pl-0 last:pr-0 min-w-0">
            <span className="text-xs uppercase tracking-wider text-text-tertiary truncate max-w-full">{label}</span>
            {rank == null ? (
              <span aria-label="Unranked" className="flex items-center h-7">
                <span className="block w-5 border-t-2 border-dashed border-text-tertiary/50" />
              </span>
            ) : (
              <span className="text-xl font-bold tabular-nums text-text-primary leading-none">
                <span className="text-sm font-semibold text-text-tertiary mr-0.5">#</span>
                {rank}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
