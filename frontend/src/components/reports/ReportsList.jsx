import ReportRow from "./ReportRow.jsx";
import ReportRowSkeleton from "../skeletons/ReportRowSkeleton.jsx";

function dateHeader(iso) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateKey(iso) {
  return iso.slice(0, 10);
}

export default function ReportsList({ reports, groupByDate = false, loading = false, skeletonCount = 5 }) {
  if (loading) {
    return (
      <div className="flex flex-col divide-y divide-white/[0.04]">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} data-testid="report-skeleton">
            <ReportRowSkeleton />
          </div>
        ))}
      </div>
    );
  }

  if (!reports || reports.length === 0) return null;

  if (!groupByDate) {
    return (
      <div className="flex flex-col divide-y divide-white/[0.04]">
        {reports.map((r) => <ReportRow key={r.id} report={r} />)}
      </div>
    );
  }

  // Group by ISO date string (YYYY-MM-DD); preserve original order within each day.
  const groups = [];
  let currentKey = null;
  for (const r of reports) {
    const k = dateKey(r.date);
    if (k !== currentKey) { groups.push({ key: k, items: [] }); currentKey = k; }
    groups[groups.length - 1].items.push(r);
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <div className="flex items-baseline justify-between pl-4 pr-3 pb-1.5">
            <h3 className="text-[10px] uppercase tracking-[0.22em] text-text-secondary font-semibold">
              {dateHeader(g.items[0].date)}
            </h3>
          </div>
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {g.items.map((r) => <ReportRow key={r.id} report={r} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
