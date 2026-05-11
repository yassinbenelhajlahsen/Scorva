import { useState } from "react";
import PerformancesList from "../highlights/tabs/PerformancesList.jsx";

const WINDOWS = [
  { id: "today",  label: "Today" },
  { id: "week",   label: "Week" },
  { id: "month",  label: "Month" },
  { id: "season", label: "Season" },
  { id: "all",    label: "All-time" },
];

export default function TeamHighlightsTab({ team, league }) {
  const [win, setWin] = useState("week");

  if (league !== "nba" || !team?.id) {
    return (
      <p className="text-center text-text-tertiary text-sm py-12">
        Team highlights are NBA-only right now.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="relative inline-flex items-center">
          <select
            value={win}
            onChange={(e) => setWin(e.target.value)}
            aria-label="Window"
            className="appearance-none bg-surface-elevated border border-white/[0.08] rounded-xl text-text-primary text-sm font-medium px-4 py-2 pr-9 cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:bg-surface-overlay focus:outline-none focus:border-accent/60"
          >
            {WINDOWS.map((w) => (
              <option key={w.id} value={w.id} className="bg-surface-primary">{w.label}</option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-2.5 w-3.5 h-3.5 text-text-tertiary"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <PerformancesList
        league={league}
        window={win}
        sort="desc"
        entity="team"
        teamId={team.id}
        limit={25}
        fallback={false}
      />
    </div>
  );
}
