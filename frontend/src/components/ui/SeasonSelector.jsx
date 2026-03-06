import { useSeasons } from "../../hooks/useSeasons.js";

export default function SeasonSelector({ league, selectedSeason, onSeasonChange }) {
  const { seasons } = useSeasons(league);

  if (seasons.length === 0) return null;

  return (
    <div className="relative inline-flex items-center">
      <select
        value={selectedSeason || seasons[0]}
        onChange={(e) => onSeasonChange(e.target.value)}
        className="appearance-none bg-surface-elevated border border-white/[0.08] rounded-xl text-text-primary text-sm font-medium px-4 py-2 pr-8 cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:bg-surface-overlay focus:outline-none focus:ring-1 focus:ring-accent/50"
      >
        {seasons.map((s) => (
          <option key={s} value={s} className="bg-surface-primary">
            {s}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 w-3.5 h-3.5 text-text-tertiary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
