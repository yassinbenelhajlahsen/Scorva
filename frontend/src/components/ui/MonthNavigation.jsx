import { useMemo } from "react";

function formatMonth(ym) {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function MonthNavigation({ games, selectedMonth, onMonthChange }) {
  const months = useMemo(() => {
    if (!games?.length) return [];
    return [...new Set(games.map((g) => String(g.date).slice(0, 7)))].sort();
  }, [games]);

  const counts = useMemo(() => {
    const map = {};
    if (!games?.length) return map;
    for (const g of games) {
      const m = String(g.date).slice(0, 7);
      map[m] = (map[m] || 0) + 1;
    }
    return map;
  }, [games]);

  if (!months.length || !selectedMonth) return null;

  const idx = months.indexOf(selectedMonth);
  const canPrev = idx > 0;
  const canNext = idx < months.length - 1;

  const btnClass =
    "flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-white/[0.06] transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed disabled:pointer-events-none";

  return (
    <div className="flex items-center justify-center gap-3 mb-6">
      <button
        onClick={() => canPrev && onMonthChange(months[idx - 1])}
        disabled={!canPrev}
        aria-label="Previous month"
        className={btnClass}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <span className="w-48 text-center text-sm font-semibold text-text-primary">
        {formatMonth(selectedMonth)}{" "}
        <span className="font-normal text-text-tertiary">({counts[selectedMonth] ?? 0})</span>
      </span>

      <button
        onClick={() => canNext && onMonthChange(months[idx + 1])}
        disabled={!canNext}
        aria-label="Next month"
        className={btnClass}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
