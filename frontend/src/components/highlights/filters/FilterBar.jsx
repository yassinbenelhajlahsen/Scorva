import { useSearchParams } from "react-router-dom";

const WINDOWS = [
  { id: "today",  label: "Today" },
  { id: "week",   label: "Week" },
  { id: "month",  label: "Month" },
  { id: "season", label: "Season" },
  { id: "all",    label: "All-time" },
];
const POSITIONS = [
  { id: "all", label: "All" },
  { id: "G",   label: "G" },
  { id: "F",   label: "F" },
  { id: "C",   label: "C" },
];
const SORTS = [
  { id: "desc", label: "Best" },
  { id: "asc",  label: "Worst" },
];

export default function FilterBar({ window, position, sort }) {
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
    <div className="flex flex-col gap-2 mb-6">
      <PillRow label="Window"   options={WINDOWS}   active={window}   onSelect={setParam("win", "week")} />
      <PillRow label="Position" options={POSITIONS} active={position} onSelect={setParam("pos", "all")} />
      <PillRow label="Sort"     options={SORTS}     active={sort}     onSelect={setParam("sort", "desc")} />
    </div>
  );
}

function PillRow({ label, options, active, onSelect }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-medium w-16 shrink-0">{label}</span>
      {options.map((o) => {
        const isActive = o.id === active;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors duration-200 ${
              isActive
                ? "bg-accent text-white border-accent"
                : "bg-surface-elevated text-text-secondary border-white/[0.08] hover:border-white/[0.14] hover:text-text-primary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
