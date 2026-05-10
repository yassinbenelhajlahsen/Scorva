import { useSearchParams } from "react-router-dom";

const WINDOWS = [
  { id: "today",  label: "Today" },
  { id: "week",   label: "Week" },
  { id: "month",  label: "Month" },
  { id: "season", label: "Season" },
  { id: "all",    label: "All-time" },
];
const POSITIONS = [
  { id: "all", label: "All positions" },
  { id: "G",   label: "Guards" },
  { id: "F",   label: "Forwards" },
  { id: "C",   label: "Centers" },
];
const SORTS = [
  { id: "desc", label: "Best" },
  { id: "asc",  label: "Worst" },
];

export default function FilterBar({
  window,
  position,
  sort,
  showPosition = true,
  defaultWindow = "week",
  defaultSort = "desc",
}) {
  const [, setSearchParams] = useSearchParams();
  const setParam = (key, defaultValue) => (next) => {
    setSearchParams((prev) => {
      const sp = new URLSearchParams(prev);
      if (!next || next === defaultValue) sp.delete(key);
      else sp.set(key, next);
      return sp;
    }, { replace: true });
  };

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <Dropdown options={WINDOWS}   value={window}   onChange={setParam("win", defaultWindow)} />
      {showPosition && (
        <Dropdown options={POSITIONS} value={position} onChange={setParam("pos", "all")} />
      )}
      <Dropdown options={SORTS}     value={sort}     onChange={setParam("sort", defaultSort)} />
    </div>
  );
}

function Dropdown({ options, value, onChange }) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-surface-elevated border border-white/[0.08] rounded-xl text-text-primary text-sm font-medium px-4 py-2 pr-9 cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-white/[0.14] hover:bg-surface-overlay focus:outline-none focus:border-accent/60"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-surface-primary">
            {o.label}
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
