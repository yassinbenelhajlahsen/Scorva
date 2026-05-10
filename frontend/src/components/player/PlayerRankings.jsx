const ITEMS = [
  { key: "week",   label: "This Week" },
  { key: "month",  label: "This Month" },
  { key: "season", label: "Season" },
];

function RankValue({ rank }) {
  if (rank == null) {
    return (
      <span
        aria-label="Unranked (outside top 250)"
        className="block w-7 h-[3px] mt-2 border-t-[3px] border-dashed border-text-tertiary"
      />
    );
  }
  return (
    <span className="font-bold text-2xl sm:text-3xl mt-1 text-text-primary tabular-nums leading-none">
      <span className="text-text-tertiary text-base font-semibold mr-0.5">#</span>
      {rank}
    </span>
  );
}

export default function PlayerRankings({ rankings }) {
  return (
    <div
      aria-label="Total rating rankings"
      className="flex flex-col gap-2 w-full sm:w-auto"
    >
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
        Rating Rank
      </h3>
      <ul className="flex flex-col divide-y divide-white/[0.06] bg-surface-elevated border border-white/[0.08] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.35)] overflow-hidden">
        {ITEMS.map(({ key, label }) => (
          <li
            key={key}
            className="flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-4"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
              {label}
            </span>
            <RankValue rank={rankings?.[key] ?? null} />
          </li>
        ))}
      </ul>
    </div>
  );
}
