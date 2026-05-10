const ITEMS = [
  { key: "week",   label: "This Week" },
  { key: "month",  label: "This Month" },
  { key: "season", label: "Season" },
];

function RankValue({ rank, label }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary leading-none">
        {label}
      </span>
      {rank == null ? (
        <span
          aria-label="Unranked"
          className="flex items-center"
          style={{ height: "2rem" }}
        >
          <span className="block w-5 border-t-2 border-dashed border-text-tertiary/50" />
        </span>
      ) : (
        <span className="font-bold tabular-nums leading-none text-text-primary" style={{ fontSize: "2rem" }}>
          <span className="text-text-tertiary font-semibold mr-px" style={{ fontSize: "0.9rem" }}>#</span>
          {rank}
        </span>
      )}
    </div>
  );
}

export default function PlayerRankings({ rankings }) {
  return (
    <div aria-label="Total rating rankings" className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Rank
      </span>
      <div className="flex flex-col gap-3 pt-1">
        {ITEMS.map(({ key, label }) => (
          <RankValue key={key} rank={rankings?.[key] ?? null} label={label} />
        ))}
      </div>
    </div>
  );
}
