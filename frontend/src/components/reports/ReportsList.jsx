import ReportRow from "./ReportRow.jsx";
import ReportRowSkeleton from "../skeletons/ReportRowSkeleton.jsx";

function dateHeader(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateKey(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function ReportsList({ reports, groupByDate = false, loading = false, skeletonCount = 5 }) {
  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden bg-surface-elevated border border-white/[0.08] divide-y divide-white/[0.04]">
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
      <div className="rounded-2xl overflow-hidden bg-surface-elevated border border-white/[0.08] divide-y divide-white/[0.04]">
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
          <h3 className="text-xs uppercase tracking-widest text-text-tertiary font-semibold px-1 mb-2">
            {dateHeader(g.items[0].date)}
          </h3>
          <div className="rounded-2xl overflow-hidden bg-surface-elevated border border-white/[0.08] divide-y divide-white/[0.04]">
            {g.items.map((r) => <ReportRow key={r.id} report={r} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
